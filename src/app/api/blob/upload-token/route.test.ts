import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

const {
  createSignedUploadUrlMock,
  createBucketMock,
  getBucketMock,
  fromMock,
} = vi.hoisted(() => {
  const createSignedUploadUrlMock = vi.fn();
  const createBucketMock = vi.fn();
  const getBucketMock = vi.fn();
  const fromMock = vi.fn(() => ({
    createSignedUploadUrl: createSignedUploadUrlMock,
  }));

  return {
    createSignedUploadUrlMock,
    createBucketMock,
    getBucketMock,
    fromMock,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: fromMock,
      getBucket: getBucketMock,
      createBucket: createBucketMock,
    },
  })),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/blob/upload-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    getBucketMock.mockResolvedValue({ data: { id: "datasets" }, error: null });
    createBucketMock.mockResolvedValue({ data: { id: "datasets" }, error: null });
    createSignedUploadUrlMock.mockResolvedValue({
      data: {
        path: "datasets/csv/generated-customers.csv",
        token: "signed-upload-token",
      },
      error: null,
    });
  });

  it("rejects unauthenticated upload authorization requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/blob/upload-token", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          sizeBytes: 100,
          contentType: "text/csv",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects upload authorization for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/blob/upload-token", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          sizeBytes: 100,
          contentType: "text/csv",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns a Supabase Storage signed upload token for the admin", async () => {
    const response = await POST(
      new Request("http://localhost/api/blob/upload-token", {
        method: "POST",
        body: JSON.stringify({
          fileName: "customers.csv",
          sizeBytes: 100,
          contentType: "text/csv",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: "supabase-storage",
      bucket: "datasets",
      token: "signed-upload-token",
    });
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(getBucketMock).toHaveBeenCalledWith("datasets");
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(createSignedUploadUrlMock).toHaveBeenCalledTimes(1);
  });
});
