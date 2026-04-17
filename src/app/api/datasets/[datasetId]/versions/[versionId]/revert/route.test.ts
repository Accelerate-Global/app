import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  DatasetVersionRevertConflictError,
  revertDatasetVersion,
} from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  DatasetVersionRevertConflictError: class DatasetVersionRevertConflictError extends Error {
    readonly status = 409;

    constructor(message = "Only ready dataset versions can be reverted.") {
      super(message);
      this.name = "DatasetVersionRevertConflictError";
    }
  },
  revertDatasetVersion: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const revertDatasetVersionMock = vi.mocked(revertDatasetVersion);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const dataset = {
  id: "dataset-1",
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  isPrimary: true,
  status: "ready" as const,
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const context = {
  params: Promise.resolve({
    datasetId: "dataset-1",
    versionId: "version-1",
  }),
};

describe("/api/datasets/[datasetId]/versions/[versionId]/revert", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/dataset-1/versions/version-1/revert", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(revertDatasetVersionMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/datasets/dataset-1/versions/version-1/revert", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(revertDatasetVersionMock).not.toHaveBeenCalled();
  });

  it("reverts a dataset version for admins", async () => {
    revertDatasetVersionMock.mockResolvedValue({ dataset });

    const response = await POST(
      new Request("http://localhost/api/datasets/dataset-1/versions/version-1/revert", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(revertDatasetVersionMock).toHaveBeenCalledWith({
      datasetId: "dataset-1",
      versionId: "version-1",
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
    });
    await expect(response.json()).resolves.toEqual({ dataset });
  });

  it("returns not found when the version does not exist", async () => {
    revertDatasetVersionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/dataset-1/versions/version-1/revert", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("returns conflicts when the version is not ready", async () => {
    revertDatasetVersionMock.mockRejectedValue(
      new DatasetVersionRevertConflictError(),
    );

    const response = await POST(
      new Request("http://localhost/api/datasets/dataset-1/versions/version-1/revert", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Only ready dataset versions can be reverted.",
    });
  });
});
