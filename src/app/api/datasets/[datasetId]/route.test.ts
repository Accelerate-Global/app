import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
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

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  DerivedDatasetMutationError: class DerivedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(message = "Derived dataset views cannot be marked as primary.") {
      super(message);
      this.name = "DerivedDatasetMutationError";
    }
  },
  deleteDataset: vi.fn(),
  getDataset: vi.fn(),
  updateDatasetDetails: vi.fn(),
  updateDatasetStatus: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const deleteDatasetMock = vi.mocked(deleteDataset);
const getDatasetMock = vi.mocked(getDataset);
const logErrorMock = vi.mocked(logError);
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
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  isPrimary: false,
  isPublic: true,
  status: "ready" as const,
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  defaultFilters: null,
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
    expect(getDatasetMock).toHaveBeenCalledWith(dataset.id, {
      includeDisabled: true,
    });
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
      isPrimary: true,
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
          isPrimary: true,
          tags: [
            {
              id: "tag-1",
              label: "Priority",
              color: "#8f9f6f",
            },
          ],
          hiddenColumnKeys: ["email"],
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: "renamed.csv",
      isPrimary: true,
      tags: [
        {
          id: "tag-1",
          label: "Priority",
          color: "#8f9f6f",
        },
      ],
      isPublic: undefined,
      hiddenColumnKeys: ["email"],
    });
    expect(updateDatasetStatusMock).not.toHaveBeenCalled();
  });

  it("updates the primary dataset flag for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      isPrimary: true,
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ isPrimary: true }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: undefined,
      tags: undefined,
      isPrimary: true,
      isPublic: undefined,
      hiddenColumnKeys: undefined,
    });
  });

  it("updates public dataset visibility for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      isPrimary: false,
      isPublic: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ isPublic: false }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: undefined,
      tags: undefined,
      isPrimary: undefined,
      isPublic: false,
      hiddenColumnKeys: undefined,
    });
  });

  it("updates hidden dataset fields for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      hiddenColumnKeys: ["email"],
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ hiddenColumnKeys: ["email"] }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: undefined,
      tags: undefined,
      isPrimary: undefined,
      isPublic: undefined,
      hiddenColumnKeys: ["email"],
    });
  });

  it("returns derived dataset mutation conflicts from metadata updates", async () => {
    const { DerivedDatasetMutationError } = await import("@/lib/datasets");
    updateDatasetDetailsMock.mockRejectedValue(new DerivedDatasetMutationError());

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ isPrimary: true }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Derived dataset views cannot be marked as primary.",
    });
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

  it("deletes database rows and all related Supabase storage objects for the admin", async () => {
    deleteDatasetMock.mockResolvedValue({
      dataset,
      blobPaths: [dataset.blobPath, "datasets/csv/customers-previous.csv"],
    });

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(deleteDatasetMock).toHaveBeenCalledWith(dataset.id);
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(removeMock).toHaveBeenCalledWith([
      dataset.blobPath,
      "datasets/csv/customers-previous.csv",
    ]);
    await expect(response.json()).resolves.toEqual({ dataset });
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

  it("logs normalized Supabase storage deletion failures without failing the delete", async () => {
    const error = new Error("storage delete failed");
    deleteDatasetMock.mockResolvedValue({
      dataset,
      blobPaths: [dataset.blobPath],
    });
    removeMock.mockResolvedValue({ data: null, error });

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(logErrorMock).toHaveBeenCalledWith(
      "Failed to delete dataset file from Supabase Storage",
      error,
    );
  });
});
