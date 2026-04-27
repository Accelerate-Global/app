import { beforeEach, describe, expect, it, vi } from "vitest";

import { getApiConnectionRunDetail } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  getApiConnectionRunDetail: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getApiConnectionRunDetailMock = vi.mocked(getApiConnectionRunDetail);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: "11111111-1111-4111-8111-111111111111",
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "test" as const,
  status: "running" as const,
  httpStatus: null,
  durationMs: 0,
  rowCount: null,
  datasetId: null,
  errorMessage: null,
  responsePreview: "",
  startedAt: "2026-04-24T12:00:01.000Z",
  completedAt: null,
  createdAt: "2026-04-24T12:00:00.000Z",
  logs: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      runId: "22222222-2222-4222-8222-222222222222",
      connectionId: "11111111-1111-4111-8111-111111111111",
      level: "info" as const,
      message: "Run started.",
      createdAt: "2026-04-24T12:00:01.000Z",
    },
  ],
  output: null,
};

const context = {
  params: Promise.resolve({ connectionId: run.connectionId, runId: run.id }),
};

describe("/api/admin/api-connections/[connectionId]/runs/[runId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects non-admin run detail requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(403);
    expect(getApiConnectionRunDetailMock).not.toHaveBeenCalled();
  });

  it("returns run details for admins", async () => {
    getApiConnectionRunDetailMock.mockResolvedValue(run);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ run });
    expect(getApiConnectionRunDetailMock).toHaveBeenCalledWith({
      connectionId: run.connectionId,
      runId: run.id,
    });
  });

  it("returns not found when the run is missing", async () => {
    getApiConnectionRunDetailMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
  });
});
