import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import {
  insertDatasetRowBatch,
  PipelineManagedDatasetMutationError,
} from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("@/lib/operational-alert-capture", () => ({
  captureOperationalEvent: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  DerivedDatasetMutationError: class DerivedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(
      message = "Derived dataset views cannot store their own dataset rows.",
    ) {
      super(message);
      this.name = "DerivedDatasetMutationError";
    }
  },
  PipelineManagedDatasetMutationError: class PipelineManagedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(
      message = "Pipeline-managed dataset rows cannot be changed through CSV batch upload.",
    ) {
      super(message);
      this.name = "PipelineManagedDatasetMutationError";
    }
  },
  insertDatasetRowBatch: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const insertDatasetRowBatchMock = vi.mocked(insertDatasetRowBatch);
const captureOperationalEventMock = vi.mocked(captureOperationalEvent);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    datasetId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  isPrimary: false,
  isWorkspaceVisible: true,
  status: "ready" as const,
  rowCount: 2,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/rows/batch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("rejects unauthenticated row batch requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 1,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(401);
    expect(insertDatasetRowBatchMock).not.toHaveBeenCalled();
  });

  it("rejects row batch writes for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 1,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(403);
    expect(insertDatasetRowBatchMock).not.toHaveBeenCalled();
  });

  it("inserts batches through the admin-only data helper", async () => {
    insertDatasetRowBatchMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 1,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 2,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(insertDatasetRowBatchMock).toHaveBeenCalledWith({
      datasetId: "f0000000-0000-4000-8000-000000000001",
      startIndex: 1,
      rows: [{ email: "ada@example.com" }],
      isFinalBatch: true,
      totalRows: 2,
    });
  });

  it("returns not found when the dataset does not exist", async () => {
    insertDatasetRowBatchMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("captures unexpected row persistence failures before returning 500", async () => {
    insertDatasetRowBatchMock.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 1,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(500);
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "dataset-upload-failed",
      operationId: "11111111-1111-4111-8111-111111111111",
      stage: "row-persistence",
      datasetId: dataset.id,
    });
  });

  it("rejects row writes for derived dataset views", async () => {
    const { DerivedDatasetMutationError } = await import("@/lib/datasets");
    insertDatasetRowBatchMock.mockRejectedValue(
      new DerivedDatasetMutationError(),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 1,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Derived dataset views cannot store their own dataset rows.",
    });
  });

  it("rejects row batch writes for pipeline-managed datasets", async () => {
    insertDatasetRowBatchMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch",
        {
          method: "POST",
          body: JSON.stringify({
            startIndex: 0,
            rows: [{ email: "ada@example.com" }],
            isFinalBatch: true,
            totalRows: 1,
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Pipeline-managed dataset rows cannot be changed through CSV batch upload.",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/datasets/[datasetId]/rows/batch/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
