import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { replaceDatasetContents } from "@/lib/datasets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  DerivedDatasetMutationError: class DerivedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(message = "Derived dataset views cannot replace their backing data.") {
      super(message);
      this.name = "DerivedDatasetMutationError";
    }
  },
  replaceDatasetContents: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const replaceDatasetContentsMock = vi.mocked(replaceDatasetContents);

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
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers-v2.csv",
  blobPath: "datasets/csv/customers-v2.csv",
  isPrimary: false,
  isPublic: true,
  status: "processing" as const,
  rowCount: 0,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/replace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated replacements", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
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
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
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
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
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
    });
  });

  it("returns not found when the dataset does not exist", async () => {
    replaceDatasetContentsMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("rejects replacements for derived dataset views", async () => {
    const { DerivedDatasetMutationError } = await import("@/lib/datasets");
    replaceDatasetContentsMock.mockRejectedValue(
      new DerivedDatasetMutationError(),
    );

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Derived dataset views cannot replace their backing data.",
    });
  });
});
