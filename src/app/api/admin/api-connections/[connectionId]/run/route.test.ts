import { beforeEach, describe, expect, it, vi } from "vitest";

import { runApiConnection } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  runApiConnection: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const runApiConnectionMock = vi.mocked(runApiConnection);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
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

const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "import" as const,
  status: "success" as const,
  httpStatus: 200,
  durationMs: 123,
  rowCount: 2,
  datasetId: "33333333-3333-4333-8333-333333333333",
  errorMessage: null,
  responsePreview: "[{\"name\":\"Alpha\"}]",
  createdAt: "2026-04-24T12:00:00.000Z",
};

const context = {
  params: Promise.resolve({ connectionId: connection.id }),
};

describe("/api/admin/api-connections/[connectionId]/run", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated runs", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: true }),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(runApiConnectionMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin runs", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: true }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(runApiConnectionMock).not.toHaveBeenCalled();
  });

  it("runs a saved API connection", async () => {
    runApiConnectionMock.mockResolvedValue({ connection, run });

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: true }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ connection, run });
    expect(runApiConnectionMock).toHaveBeenCalledWith({
      connectionId: connection.id,
      identity,
      importEnabled: true,
    });
  });

  it("returns not found for missing connections", async () => {
    runApiConnectionMock.mockResolvedValue(null);

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: false }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });
});
