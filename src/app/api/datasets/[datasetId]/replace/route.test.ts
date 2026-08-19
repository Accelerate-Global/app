import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import {
  DatasetStoragePathConflictError,
  PipelineManagedDatasetMutationError,
  replaceDatasetContents,
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
  DatasetStoragePathConflictError: class DatasetStoragePathConflictError extends Error {
    readonly status = 409;

    constructor(
      message = "That uploaded file is already owned by another dataset.",
    ) {
      super(message);
      this.name = "DatasetStoragePathConflictError";
    }
  },
  PipelineManagedDatasetMutationError: class PipelineManagedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(
      message = "Pipeline-managed datasets cannot be replaced through dataset upload.",
    ) {
      super(message);
      this.name = "PipelineManagedDatasetMutationError";
    }
  },
  replaceDatasetContents: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const replaceDatasetContentsMock = vi.mocked(replaceDatasetContents);
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
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers-v2.csv",
  blobPath: "datasets/csv/customers-v2.csv",
  isPrimary: false,
  isWorkspaceVisible: true,
  status: "processing" as const,
  rowCount: 0,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [
    {
      id: "dataset-classification-pgac",
      label: "PGAC",
      color: "#fcab2a",
    },
  ],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/replace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("rejects unauthenticated replacements", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(401);
    expect(replaceDatasetContentsMock).not.toHaveBeenCalled();
  });

  it("rejects replacements for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(403);
    expect(replaceDatasetContentsMock).not.toHaveBeenCalled();
  });

  it("replaces the dataset while preserving upload history", async () => {
    replaceDatasetContentsMock.mockResolvedValue({
      dataset,
    });

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(replaceDatasetContentsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
      blobPath: "datasets/csv/customers-v2.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
      classification: "PGAC",
    });
  });

  it("returns not found when the dataset does not exist", async () => {
    replaceDatasetContentsMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("captures unexpected replacement failures before returning 500", async () => {
    replaceDatasetContentsMock.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(500);
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "dataset-upload-failed",
      operationId: "11111111-1111-4111-8111-111111111111",
      stage: "dataset-replace",
      datasetId: dataset.id,
    });
  });

  it("rejects replacements for pipeline-managed datasets", async () => {
    replaceDatasetContentsMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Pipeline-managed datasets cannot be replaced through dataset upload.",
    });
  });

  it("returns a conflict when another dataset owns the replacement storage path", async () => {
    replaceDatasetContentsMock.mockRejectedValue(
      new DatasetStoragePathConflictError(),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
            classification: "PGAC",
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That uploaded file is already owned by another dataset.",
    });
  });

  it("rejects replacement payloads without a PGAC or PGIC classification", async () => {
    const response = await POST(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace",
        {
          method: "POST",
          body: JSON.stringify({
            blobPath: "datasets/csv/customers-v2.csv",
            sizeBytes: 100,
            columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(400);
    expect(replaceDatasetContentsMock).not.toHaveBeenCalled();
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/datasets/[datasetId]/replace/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
