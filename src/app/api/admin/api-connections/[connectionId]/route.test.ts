import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteApiConnection, updateApiConnection } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { DELETE, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  deleteApiConnection: vi.fn(),
  updateApiConnection: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateApiConnectionMock = vi.mocked(updateApiConnection);
const deleteApiConnectionMock = vi.mocked(deleteApiConnection);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const connection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "People API",
  description: "",
  method: "GET" as const,
  url: "https://api.example.com/people",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json" as const,
  responseDataPath: "data",
  importMode: "create" as const,
  targetDatasetId: null,
  datasetName: "people.csv",
  datasetClassification: "PGAC" as const,
  createdAt: "2026-04-24T12:00:00.000Z",
  updatedAt: "2026-04-24T12:00:00.000Z",
};

const validPayload = {
  name: "People API",
  description: "",
  method: "GET",
  url: "https://api.example.com/people",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "data",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "people.csv",
  datasetClassification: "PGAC",
};

describe("/api/admin/api-connections/[connectionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects non-admin updates", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}`, {
        method: "PATCH",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(403);
    expect(updateApiConnectionMock).not.toHaveBeenCalled();
  });

  it("rejects admin updates because profiles are code-managed", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}`, {
        method: "PATCH",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "API connection profiles are managed from the codebase.",
    });
    expect(updateApiConnectionMock).not.toHaveBeenCalled();
  });

  it("rejects admin deletes because profiles are code-managed", async () => {
    const response = await DELETE();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "API connection profiles are managed from the codebase.",
    });
    expect(deleteApiConnectionMock).not.toHaveBeenCalled();
  });
});
