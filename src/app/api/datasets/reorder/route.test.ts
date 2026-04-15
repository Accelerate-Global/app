import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { reorderDatasets } from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  reorderDatasets: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const reorderDatasetsMock = vi.mocked(reorderDatasets);

const adminIdentity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const orderedDatasets = [
  {
    id: "f0000000-0000-4000-8000-000000000001",
    sortOrder: 0,
    fileName: "customers.csv",
    blobUrl:
      "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
    blobPath: "datasets/csv/customers.csv",
    isPrimary: false,
    status: "ready" as const,
    rowCount: 10,
    sizeBytes: 100,
    columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
    hiddenColumnKeys: [],
    tags: [],
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "f0000000-0000-4000-8000-000000000002",
    sortOrder: 1,
    fileName: "teams.csv",
    blobUrl:
      "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/teams.csv",
    blobPath: "datasets/csv/teams.csv",
    isPrimary: false,
    status: "ready" as const,
    rowCount: 7,
    sizeBytes: 80,
    columns: [{ key: "team", label: "Team", sourceIndex: 0 }],
    hiddenColumnKeys: [],
    tags: [],
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("/api/datasets/reorder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated reorder requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/reorder", {
        method: "POST",
        body: JSON.stringify({ datasetIds: orderedDatasets.map((dataset) => dataset.id) }),
      }),
    );

    expect(response.status).toBe(401);
    expect(reorderDatasetsMock).not.toHaveBeenCalled();
  });

  it("rejects reorder requests for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...adminIdentity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/datasets/reorder", {
        method: "POST",
        body: JSON.stringify({ datasetIds: orderedDatasets.map((dataset) => dataset.id) }),
      }),
    );

    expect(response.status).toBe(403);
    expect(reorderDatasetsMock).not.toHaveBeenCalled();
  });

  it("reorders datasets for the configured admin", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    reorderDatasetsMock.mockResolvedValue(orderedDatasets);

    const response = await POST(
      new Request("http://localhost/api/datasets/reorder", {
        method: "POST",
        body: JSON.stringify({ datasetIds: orderedDatasets.map((dataset) => dataset.id) }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ datasets: orderedDatasets });
    expect(reorderDatasetsMock).toHaveBeenCalledWith([
      "f0000000-0000-4000-8000-000000000001",
      "f0000000-0000-4000-8000-000000000002",
    ]);
  });

  it("rejects duplicate dataset ids", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);

    const response = await POST(
      new Request("http://localhost/api/datasets/reorder", {
        method: "POST",
        body: JSON.stringify({
          datasetIds: [
            "f0000000-0000-4000-8000-000000000001",
            "f0000000-0000-4000-8000-000000000001",
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(reorderDatasetsMock).not.toHaveBeenCalled();
  });
});
