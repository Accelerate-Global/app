import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiConnection, listApiConnections } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ...actual,
    createApiConnection: vi.fn(),
    listApiConnections: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listApiConnectionsMock = vi.mocked(listApiConnections);
const createApiConnectionMock = vi.mocked(createApiConnection);

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

describe("/api/admin/api-connections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated list requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listApiConnectionsMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin create requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/api-connections", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(403);
    expect(createApiConnectionMock).not.toHaveBeenCalled();
  });

  it("lists API connections for admins", async () => {
    listApiConnectionsMock.mockResolvedValue({ connections: [connection], runs: [] });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      connections: [connection],
      runs: [],
    });
  });

  it("rejects admin create requests because profiles are code-managed", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/api-connections", {
        method: "POST",
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "API connection profiles are managed from the codebase.",
    });
    expect(createApiConnectionMock).not.toHaveBeenCalled();
  });
});
