import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listDatasetVersions } from "@/lib/datasets";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  listDatasetVersions: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listDatasetVersionsMock = vi.mocked(listDatasetVersions);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const versions = [
  {
    id: "dataset-1",
    datasetId: "dataset-1",
    isCurrent: true,
    fileName: "customers.csv",
    action: "replace" as const,
    actorOwnerId: "supabase-user",
    actorEmail: "admin@example.com",
    status: "ready" as const,
    rowCount: 2,
    sizeBytes: 100,
    columnCount: 1,
    versionCreatedAt: new Date("2026-04-17T10:00:00.000Z").toISOString(),
    archivedAt: null,
  },
];

const context = {
  params: Promise.resolve({
    datasetId: "dataset-1",
  }),
};

describe("/api/datasets/[datasetId]/versions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/dataset-1/versions"),
      context,
    );

    expect(response.status).toBe(401);
    expect(listDatasetVersionsMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await GET(
      new Request("http://localhost/api/datasets/dataset-1/versions"),
      context,
    );

    expect(response.status).toBe(403);
    expect(listDatasetVersionsMock).not.toHaveBeenCalled();
  });

  it("returns the upload history for admins", async () => {
    listDatasetVersionsMock.mockResolvedValue(versions);

    const response = await GET(
      new Request("http://localhost/api/datasets/dataset-1/versions"),
      context,
    );

    expect(response.status).toBe(200);
    expect(listDatasetVersionsMock).toHaveBeenCalledWith("dataset-1");
    await expect(response.json()).resolves.toEqual({ versions });
  });

  it("returns not found when the dataset does not exist", async () => {
    listDatasetVersionsMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/dataset-1/versions"),
      context,
    );

    expect(response.status).toBe(404);
  });
});
