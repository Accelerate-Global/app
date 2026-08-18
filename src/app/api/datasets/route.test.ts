import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import {
  DatasetStoragePathConflictError,
  createDataset,
  listDatasets,
} from "@/lib/datasets";
import { GET, POST } from "./route";

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
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createDatasetMock = vi.mocked(createDataset);
const listDatasetsMock = vi.mocked(listDatasets);
const captureOperationalEventMock = vi.mocked(captureOperationalEvent);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
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

describe("/api/datasets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("rejects unauthenticated list requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listDatasetsMock).not.toHaveBeenCalled();
  });

  it("lists datasets for any authenticated user", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    listDatasetsMock.mockResolvedValue([dataset]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ datasets: [dataset] });
    expect(listDatasetsMock).toHaveBeenCalledWith({
      includeDisabled: true,
    });
  });

  it("creates dataset records for the configured admin", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createDatasetMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(createDatasetMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      actorEmail: "admin@example.com",
      fileName: "customers.csv",
      blobPath: "datasets/csv/customers.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
      classification: "PGAC",
      isWorkspaceVisible: true,
    });
  });

  it("creates a reviewed private dataset", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createDatasetMock.mockResolvedValue({ ...dataset, isWorkspaceVisible: false });

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "Private people",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
          isWorkspaceVisible: false,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createDatasetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "Private people",
        isWorkspaceVisible: false,
      }),
    );
  });

  it("returns a conflict when another dataset already owns the storage path", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createDatasetMock.mockRejectedValue(new DatasetStoragePathConflictError());

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That uploaded file is already owned by another dataset.",
    });
  });

  it("captures unexpected dataset creation failures before returning 500", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createDatasetMock.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "dataset-upload-failed",
      operationId: "11111111-1111-4111-8111-111111111111",
      stage: "dataset-create",
    });
  });

  it("rejects dataset creation for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createDatasetMock).not.toHaveBeenCalled();
  });

  it("rejects dataset records outside the shared storage prefix", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "users/other-user/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
          classification: "PGAC",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createDatasetMock).not.toHaveBeenCalled();
  });

  it("rejects dataset creation payloads without a PGAC or PGIC classification", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobPath: "datasets/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createDatasetMock).not.toHaveBeenCalled();
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile("src/app/api/datasets/route.ts", "utf8");

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
