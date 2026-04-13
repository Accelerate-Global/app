import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentOwnerId, BYPASS_OWNER_ID } from "@/lib/auth";
import { createDataset, listDatasets } from "@/lib/datasets";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  BYPASS_OWNER_ID: "bypass-user",
  getCurrentOwnerId: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
}));

const getCurrentOwnerIdMock = vi.mocked(getCurrentOwnerId);
const createDatasetMock = vi.mocked(createDataset);
const listDatasetsMock = vi.mocked(listDatasets);

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  fileName: "customers.csv",
  blobUrl: "https://blob.vercel-storage.com/customers.csv",
  blobPath: "users/supabase-user/csv/customers.csv",
  status: "processing" as const,
  rowCount: 0,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated list requests", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listDatasetsMock).not.toHaveBeenCalled();
  });

  it("lists datasets for the authenticated user", async () => {
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");
    listDatasetsMock.mockResolvedValue([dataset]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ datasets: [dataset] });
    expect(listDatasetsMock).toHaveBeenCalledWith("supabase-user");
  });

  it("lists datasets for the bypass owner", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(BYPASS_OWNER_ID);
    listDatasetsMock.mockResolvedValue([dataset]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ datasets: [dataset] });
    expect(listDatasetsMock).toHaveBeenCalledWith(BYPASS_OWNER_ID);
  });

  it("creates owner-scoped dataset records", async () => {
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");
    createDatasetMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobUrl: "https://blob.vercel-storage.com/customers.csv",
          blobPath: "users/supabase-user/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(createDatasetMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      fileName: "customers.csv",
      blobUrl: "https://blob.vercel-storage.com/customers.csv",
      blobPath: "users/supabase-user/csv/customers.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
    });
  });

  it("creates bypass-scoped dataset records", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(BYPASS_OWNER_ID);
    createDatasetMock.mockResolvedValue(dataset);

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobUrl: "https://blob.vercel-storage.com/customers.csv",
          blobPath: "users/bypass-user/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createDatasetMock).toHaveBeenCalledWith({
      ownerId: BYPASS_OWNER_ID,
      fileName: "customers.csv",
      blobUrl: "https://blob.vercel-storage.com/customers.csv",
      blobPath: "users/bypass-user/csv/customers.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
    });
  });

  it("rejects dataset records for another owner's blob path", async () => {
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");

    const response = await POST(
      new Request("http://localhost/api/datasets", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          blobUrl: "https://blob.vercel-storage.com/customers.csv",
          blobPath: "users/other-user/csv/customers.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createDatasetMock).not.toHaveBeenCalled();
  });
});
