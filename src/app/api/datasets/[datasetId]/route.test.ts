import { del } from "@vercel/blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BYPASS_OWNER_ID, getCurrentOwnerId } from "@/lib/auth";
import {
  deleteDatasetForOwner,
  getDatasetForOwner,
  updateDatasetStatus,
} from "@/lib/datasets";
import { DELETE, GET, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  BYPASS_OWNER_ID: "bypass-user",
  getCurrentOwnerId: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  deleteDatasetForOwner: vi.fn(),
  getDatasetForOwner: vi.fn(),
  updateDatasetStatus: vi.fn(),
}));

const getCurrentOwnerIdMock = vi.mocked(getCurrentOwnerId);
const delMock = vi.mocked(del);
const deleteDatasetForOwnerMock = vi.mocked(deleteDatasetForOwner);
const getDatasetForOwnerMock = vi.mocked(getDatasetForOwner);
const updateDatasetStatusMock = vi.mocked(updateDatasetStatus);

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
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");
  });

  it("rejects unauthenticated dataset requests", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetForOwnerMock).not.toHaveBeenCalled();
  });

  it("returns not found when the dataset does not belong to the user", async () => {
    getDatasetForOwnerMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("updates status only through the owner-scoped data helper", async () => {
    updateDatasetStatusMock.mockResolvedValue({
      ...dataset,
      status: "failed",
      error: "bad csv",
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", error: "bad csv" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetStatusMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      ownerId: "supabase-user",
      status: "failed",
      error: "bad csv",
    });
  });

  it("updates status for the bypass owner", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(BYPASS_OWNER_ID);
    updateDatasetStatusMock.mockResolvedValue({
      ...dataset,
      status: "ready",
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ status: "ready" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetStatusMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      ownerId: BYPASS_OWNER_ID,
      status: "ready",
      error: undefined,
    });
  });

  it("deletes database rows and the private blob for the owner", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_store_secret");
    deleteDatasetForOwnerMock.mockResolvedValue(dataset);
    delMock.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(deleteDatasetForOwnerMock).toHaveBeenCalledWith(
      dataset.id,
      "supabase-user",
    );
    expect(delMock).toHaveBeenCalledWith(dataset.blobUrl, {
      token: "vercel_blob_rw_test_store_secret",
    });
  });

  it("skips blob deletion for local development placeholder files", async () => {
    deleteDatasetForOwnerMock.mockResolvedValue({
      ...dataset,
      blobUrl: "http://localhost:3000/api/blob/local/users%2Fuser_1%2Fcsv%2Fcustomers.csv",
    });

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });
});
