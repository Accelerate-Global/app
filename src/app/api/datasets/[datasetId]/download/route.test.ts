import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

const { createSignedUrlMock, fromMock } = vi.hoisted(() => {
  const createSignedUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({
    createSignedUrl: createSignedUrlMock,
  }));

  return { createSignedUrlMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: fromMock,
    },
  })),
}));

vi.mock("@/lib/datasets", () => ({
  getDataset: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);

const adminIdentity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const viewerIdentity = {
  ownerId: "viewer-user",
  email: "viewer@example.com",
  isDatasetAdmin: false,
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
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/datasets/[datasetId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentIdentityMock.mockResolvedValue(viewerIdentity);
    getDatasetMock.mockResolvedValue(dataset);
    createSignedUrlMock.mockResolvedValue({
      data: {
        signedUrl: "https://example.supabase.co/storage/v1/object/sign/datasets/csv/customers.csv",
      },
      error: null,
    });
  });

  it("rejects unauthenticated downloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetMock).not.toHaveBeenCalled();
  });

  it("returns not found when the dataset does not exist", async () => {
    getDatasetMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(404);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("creates a signed download URL for authenticated viewers", async () => {
    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.supabase.co/storage/v1/object/sign/datasets/csv/customers.csv",
    );
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(createSignedUrlMock).toHaveBeenCalledWith(dataset.blobPath, 60, {
      download: dataset.fileName,
    });
  });

  it("also allows admins to download datasets", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(302);
  });

  it("returns a gateway error when signing fails", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(502);
  });
});
