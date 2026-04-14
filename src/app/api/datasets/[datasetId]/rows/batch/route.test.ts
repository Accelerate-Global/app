import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { insertDatasetRowBatch } from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  insertDatasetRowBatch: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const insertDatasetRowBatchMock = vi.mocked(insertDatasetRowBatch);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
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
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  status: "ready" as const,
  rowCount: 2,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/rows/batch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated row batch requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch", {
        method: "POST",
        body: JSON.stringify({
          startIndex: 0,
          rows: [{ email: "ada@example.com" }],
          isFinalBatch: true,
          totalRows: 1,
        }),
      }),
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
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch", {
        method: "POST",
        body: JSON.stringify({
          startIndex: 0,
          rows: [{ email: "ada@example.com" }],
          isFinalBatch: true,
          totalRows: 1,
        }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(insertDatasetRowBatchMock).not.toHaveBeenCalled();
  });

  it("inserts batches through the admin-only data helper", async () => {
    insertDatasetRowBatchMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch", {
        method: "POST",
        body: JSON.stringify({
          startIndex: 1,
          rows: [{ email: "ada@example.com" }],
          isFinalBatch: true,
          totalRows: 2,
        }),
      }),
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
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows/batch", {
        method: "POST",
        body: JSON.stringify({
          startIndex: 0,
          rows: [{ email: "ada@example.com" }],
          isFinalBatch: true,
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });
});
