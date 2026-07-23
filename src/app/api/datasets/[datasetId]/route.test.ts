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
  DatasetClassificationError: class DatasetClassificationError extends Error {
    readonly status = 409;

    constructor(
      message = "Source datasets must include exactly one PGAC or PGIC tag.",
    ) {
      super(message);
      this.name = "DatasetClassificationError";
    }
  },
  DerivedDatasetMutationError: class DerivedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(message = "Derived dataset views cannot be marked as primary.") {
      super(message);
      this.name = "DerivedDatasetMutationError";
    }
  },
  PipelineManagedDatasetMutationError: class PipelineManagedDatasetMutationError extends Error {
    readonly status = 409;

    constructor(
      message = "Pipeline-managed datasets can only be changed through Pipeline Products.",
    ) {
      super(message);
      this.name = "PipelineManagedDatasetMutationError";
    }
  },
  DatasetDeleteConflictError: class DatasetDeleteConflictError extends Error {
    readonly status = 409;

    constructor(
      message = "Datasets used as a backing source cannot be deleted while derived views still reference them.",
    ) {
      super(message);
      this.name = "DatasetDeleteConflictError";
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
  workspaceRole: "admin" as const,
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
  sourceOrganizationName: null,
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  isPrimary: false,
  isWorkspaceVisible: true,
  status: "ready" as const,
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [
    {
      id: "dataset-classification-pgac",
      label: "PGAC",
      color: "#fcab2a",
    },
  ],
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
      sourceOrganizationName: undefined,
      isPrimary: true,
      tags: [
        {
          id: "tag-1",
          label: "Priority",
          color: "#8f9f6f",
        },
      ],
      isWorkspaceVisible: undefined,
      hiddenColumnKeys: ["email"],
    });
    expect(updateDatasetStatusMock).not.toHaveBeenCalled();
  });

  it("updates dataset source organization labels for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      sourceOrganizationName: "Joshua Project",
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ sourceOrganizationName: "Joshua Project" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: undefined,
      sourceOrganizationName: "Joshua Project",
      tags: undefined,
      isPrimary: undefined,
      isWorkspaceVisible: undefined,
      hiddenColumnKeys: undefined,
    });
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
      sourceOrganizationName: undefined,
      tags: undefined,
      isPrimary: true,
      isWorkspaceVisible: undefined,
      hiddenColumnKeys: undefined,
    });
  });

  it("updates workspace-visible dataset visibility for the configured admin", async () => {
    updateDatasetDetailsMock.mockResolvedValue({
      ...dataset,
      isPrimary: false,
      isWorkspaceVisible: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ isWorkspaceVisible: false }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateDatasetDetailsMock).toHaveBeenCalledWith({
      datasetId: dataset.id,
      fileName: undefined,
      sourceOrganizationName: undefined,
      tags: undefined,
      isPrimary: undefined,
      isWorkspaceVisible: false,
      hiddenColumnKeys: undefined,
    });
  });

  it("rejects generic visibility changes for pipeline-managed datasets", async () => {
    const { PipelineManagedDatasetMutationError } = await import("@/lib/datasets");
    updateDatasetDetailsMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(
        "Pipeline-managed dataset visibility is controlled by its published product definition.",
      ),
    );

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ isWorkspaceVisible: false }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Pipeline-managed dataset visibility is controlled by its published product definition.",
    });
  });

  it("rejects generic classification and tag changes for pipeline-managed datasets", async () => {
    const { PipelineManagedDatasetMutationError } = await import("@/lib/datasets");
    updateDatasetDetailsMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(
        "Pipeline-managed dataset classification and tags are controlled by its published product definition.",
      ),
    );

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          tags: [
            {
              id: "dataset-classification-pgic",
              label: "PGIC",
              color: "#078bc9",
            },
          ],
        }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Pipeline-managed dataset classification and tags are controlled by its published product definition.",
    });
  });

  it("rejects generic status changes for pipeline-managed datasets", async () => {
    const { PipelineManagedDatasetMutationError } = await import("@/lib/datasets");
    updateDatasetStatusMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(
        "Pipeline-managed dataset status is controlled by Pipeline Products.",
      ),
    );

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", error: "manual override" }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Pipeline-managed dataset status is controlled by Pipeline Products.",
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
      sourceOrganizationName: undefined,
      tags: undefined,
      isPrimary: undefined,
      isWorkspaceVisible: undefined,
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

  it("returns source classification conflicts from metadata updates", async () => {
    const { DatasetClassificationError } = await import("@/lib/datasets");
    updateDatasetDetailsMock.mockRejectedValue(new DatasetClassificationError());

    const response = await PATCH(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          fileName: "renamed.csv",
          tags: [],
        }),
      }),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Source datasets must include exactly one PGAC or PGIC tag.",
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

  it("rejects deletion of pipeline-managed datasets without touching storage", async () => {
    const { PipelineManagedDatasetMutationError } = await import("@/lib/datasets");
    deleteDatasetMock.mockRejectedValue(
      new PipelineManagedDatasetMutationError(
        "Pipeline-managed datasets cannot be deleted through dataset administration.",
      ),
    );

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Pipeline-managed datasets cannot be deleted through dataset administration.",
    });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("does not remove storage paths that remain referenced after dataset deletion", async () => {
    deleteDatasetMock.mockResolvedValue({
      dataset,
      blobPaths: [],
    });

    const response = await DELETE(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
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
