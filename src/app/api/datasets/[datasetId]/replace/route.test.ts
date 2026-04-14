import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { replaceDatasetContents } from "@/lib/datasets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

const { removeMock, fromMock } = vi.hoisted(() => {
  const removeMock = vi.fn();
  const fromMock = vi.fn(() => ({
    remove: removeMock,
  }));

  return { removeMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: fromMock,
    },
  })),
}));

vi.mock("@/lib/datasets", () => ({
  replaceDatasetContents: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const replaceDatasetContentsMock = vi.mocked(replaceDatasetContents);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);

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
  fileName: "customers-v2.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers-v2.csv",
  blobPath: "datasets/csv/customers-v2.csv",
  status: "processing" as const,
  rowCount: 0,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/replace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue({ remove: removeMock });
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated replacements", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers-v2.csv",
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
          fileName: "customers-v2.csv",
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

  it("replaces the dataset and removes the previous stored CSV", async () => {
    replaceDatasetContentsMock.mockResolvedValue({
      dataset,
      previousBlobPath: "datasets/csv/customers.csv",
    });

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers-v2.csv",
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
      fileName: "customers-v2.csv",
      blobPath: "datasets/csv/customers-v2.csv",
      sizeBytes: 100,
      columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
    });
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(removeMock).toHaveBeenCalledWith(["datasets/csv/customers.csv"]);
  });

  it("returns not found when the dataset does not exist", async () => {
    replaceDatasetContentsMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/replace", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers-v2.csv",
          blobPath: "datasets/csv/customers-v2.csv",
          sizeBytes: 100,
          columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
