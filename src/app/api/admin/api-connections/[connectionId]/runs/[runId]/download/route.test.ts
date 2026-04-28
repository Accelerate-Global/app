import { beforeEach, describe, expect, it, vi } from "vitest";

import { getApiConnectionRunOutputDownload } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  getApiConnectionRunOutputDownload: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getApiConnectionRunOutputDownloadMock = vi.mocked(
  getApiConnectionRunOutputDownload,
);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const connectionId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const context = {
  params: Promise.resolve({ connectionId, runId }),
};

describe("/api/admin/api-connections/[connectionId]/runs/[runId]/download", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated downloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost?format=json"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getApiConnectionRunOutputDownloadMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported formats", async () => {
    const response = await GET(
      new Request("http://localhost?format=xlsx"),
      context,
    );

    expect(response.status).toBe(400);
    expect(getApiConnectionRunOutputDownloadMock).not.toHaveBeenCalled();
  });

  it("downloads JSON output for admins", async () => {
    getApiConnectionRunOutputDownloadMock.mockResolvedValue({
      body: "{\"rawResponse\":\"[]\"}",
      contentType: "application/json; charset=utf-8",
      fileName: "api-connection-run.json",
    });

    const response = await GET(
      new Request("http://localhost?format=json"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      "api-connection-run.json",
    );
    await expect(response.text()).resolves.toBe("{\"rawResponse\":\"[]\"}");
    expect(getApiConnectionRunOutputDownloadMock).toHaveBeenCalledWith({
      connectionId,
      runId,
      format: "json",
    });
  });

  it("returns not found when output is missing", async () => {
    getApiConnectionRunOutputDownloadMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost?format=csv"),
      context,
    );

    expect(response.status).toBe(404);
  });
});
