import { beforeEach, describe, expect, it, vi } from "vitest";

import { listApiConnectionRuns } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  listApiConnectionRuns: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listApiConnectionRunsMock = vi.mocked(listApiConnectionRuns);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: "11111111-1111-4111-8111-111111111111",
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "test" as const,
  status: "success" as const,
  httpStatus: 200,
  durationMs: 41,
  rowCount: 2,
  datasetId: null,
  errorMessage: null,
  responsePreview: "[{\"name\":\"Alpha\"}]",
  startedAt: "2026-04-24T12:00:01.000Z",
  completedAt: "2026-04-24T12:00:02.000Z",
  createdAt: "2026-04-24T12:00:00.000Z",
  logs: [],
  output: null,
};

const context = {
  params: Promise.resolve({ connectionId: run.connectionId }),
};

describe("/api/admin/api-connections/[connectionId]/runs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated run history requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(401);
    expect(listApiConnectionRunsMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin run history requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(403);
    expect(listApiConnectionRunsMock).not.toHaveBeenCalled();
  });

  it("lists runs for admins", async () => {
    listApiConnectionRunsMock.mockResolvedValue([run]);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runs: [run] });
    expect(listApiConnectionRunsMock).toHaveBeenCalledWith(run.connectionId);
  });
});
