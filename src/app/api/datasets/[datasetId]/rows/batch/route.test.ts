import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentOwnerId } from "@/lib/auth";
import { insertDatasetRowBatch } from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentOwnerId: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  insertDatasetRowBatch: vi.fn(),
}));

const getCurrentOwnerIdMock = vi.mocked(getCurrentOwnerId);
const insertDatasetRowBatchMock = vi.mocked(insertDatasetRowBatch);

const context = {
  params: Promise.resolve({
    datasetId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  fileName: "customers.csv",
  blobUrl: "https://blob.vercel-storage.com/customers.csv",
  blobPath: "users/user_1/csv/customers.csv",
  status: "ready" as const,
  rowCount: 2,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/rows/batch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");
  });

  it("rejects unauthenticated row batch requests", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(null);

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

  it("inserts batches through the Supabase owner id", async () => {
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
      ownerId: "supabase-user",
      startIndex: 1,
      rows: [{ email: "ada@example.com" }],
      isFinalBatch: true,
      totalRows: 2,
    });
  });

  it("returns not found for cross-owner batch writes", async () => {
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
