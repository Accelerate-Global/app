import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deleteDataset,
  getDataset,
  updateDatasetDetails,
  updateDatasetStatus,
} from "@/lib/datasets";
import { DELETE, GET, PATCH } from "./route";

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
  deleteDataset: vi.fn(),
  getDataset: vi.fn(),
  updateDatasetDetails: vi.fn(),
  updateDatasetStatus: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const deleteDatasetMock = vi.mocked(deleteDataset);
const getDatasetMock = vi.mocked(getDataset);
const updateDatasetDetailsMock = vi.mocked(updateDatasetDetails);
const updateDatasetStatusMock = vi.mocked(updateDatasetStatus);

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

describe("/api/datasets/[datasetId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue({ remove: removeMock });
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated dataset requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetMock).not.toHaveBeenCalled();
  });

  it("returns not found when the dataset does not exist", async () => {
    getDatasetMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("updates status only for the configured admin", async () => {
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
      status: "failed",
      error: "bad csv",
    });
  });

  it("renames datasets for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      fileName: "renamed.csv",
      tags: [
        {
          id: "tag-1",
          label: "Priority",
          color: "#8f9f6f",
        },
      ],
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          fileName: "renamed.csv",
          tags: [
            {
              id: "tag-1",
              label: "Priority",
              color: "#8f9f6f",
            },
          ],
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: "renamed.csv",
      tags: [
        {
          id: "tag-1",
          label: "Priority",
          color: "#8f9f6f",
        },
      ],
    });
    expect(updateDatasetStatusMock).not.toHaveBeenCalled();
  });

  it("rejects dataset mutations for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", error: "bad csv" }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(updateDatasetStatusMock).not.toHaveBeenCalled();
  });

  it("deletes database rows and the Supabase storage object for the admin", async () => {
    deleteDatasetMock.mockResolvedValue(dataset);

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(deleteDatasetMock).toHaveBeenCalledWith(dataset.id);
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(removeMock).toHaveBeenCalledWith([dataset.blobPath]);
  });

  it("rejects deletes for non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(403);
    expect(deleteDatasetMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });
});
