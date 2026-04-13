import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createDataset, listDatasets } from "@/lib/datasets";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createDatasetMock = vi.mocked(createDataset);
const listDatasetsMock = vi.mocked(listDatasets);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
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
    expect(listDatasetsMock).toHaveBeenCalledWith();
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
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ dataset });
    expect(createDatasetMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      fileName: "customers.csv",
      blobPath: "datasets/csv/customers.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
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
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createDatasetMock).not.toHaveBeenCalled();
  });
});
