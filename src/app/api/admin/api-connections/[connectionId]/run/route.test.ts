import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeApiConnectionRun,
  startApiConnectionRun,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { POST } from "./route";

const { afterMock } = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => void | Promise<void>) => {
    void callback();
  }),
}));

vi.mock("next/server", () => ({
  after: afterMock,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  executeApiConnectionRun: vi.fn(),
  startApiConnectionRun: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const executeApiConnectionRunMock = vi.mocked(executeApiConnectionRun);
const startApiConnectionRunMock = vi.mocked(startApiConnectionRun);

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

const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "import" as const,
  status: "queued" as const,
  httpStatus: null,
  durationMs: 0,
  rowCount: null,
  datasetId: null,
  errorMessage: null,
  responsePreview: "",
  startedAt: null,
  completedAt: null,
  createdAt: "2026-04-24T12:00:00.000Z",
  logs: [],
  output: null,
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
    expect(startApiConnectionRunMock).not.toHaveBeenCalled();
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
    expect(startApiConnectionRunMock).not.toHaveBeenCalled();
  });

  it("queues a saved API connection run and schedules execution", async () => {
    startApiConnectionRunMock.mockResolvedValue({ connection, run });

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: true }),
      }),
      context,
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ connection, run });
    expect(startApiConnectionRunMock).toHaveBeenCalledWith({
      connectionId: connection.id,
      identity,
      importEnabled: true,
    });
    expect(afterMock).toHaveBeenCalled();
    expect(executeApiConnectionRunMock).toHaveBeenCalledWith({ runId: run.id });
  });

  it("returns not found for missing connections", async () => {
    startApiConnectionRunMock.mockResolvedValue(null);

    const response = await POST(
      new Request(`http://localhost/api/admin/api-connections/${connection.id}/run`, {
        method: "POST",
        body: JSON.stringify({ importEnabled: false }),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(afterMock).not.toHaveBeenCalled();
  });
});
