import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, storageFromMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: storageFromMock,
    },
  })),
}));

const outputRow = {
  runId: "run-1",
  connectionId: "connection-1",
  rowsStoragePath: "api-connection-runs/run-1/rows.json",
  rawStoragePath: "api-connection-runs/run-1/raw-response.json",
};

function createDbWithOutput(output: typeof outputRow | null) {
  const limit = vi.fn().mockResolvedValue(output ? [output] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { select };
}

describe("API connection output artifact downloads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SUPABASE_API_CONNECTION_ARTIFACT_BUCKET;
    delete process.env.SUPABASE_STORAGE_BUCKET;
  });

  it("downloads output artifacts from the dedicated artifact bucket first", async () => {
    const artifactDownload = vi.fn().mockResolvedValue({
      data: new Blob(["{\"rawResponse\":\"[]\"}"]),
      error: null,
    });
    const legacyDownload = vi.fn();
    getDbMock.mockReturnValue(createDbWithOutput(outputRow));
    storageFromMock.mockImplementation((bucket: string) => ({
      download:
        bucket === "api-connection-artifacts" ? artifactDownload : legacyDownload,
    }));

    const { getApiConnectionRunOutputDownload } = await import(
      "@/lib/api-connections"
    );

    const download = await getApiConnectionRunOutputDownload({
      connectionId: "connection-1",
      runId: "run-1",
      format: "json",
    });

    expect(download?.body).toBe("{\"rawResponse\":\"[]\"}");
    expect(download?.contentType).toBe("application/json; charset=utf-8");
    expect(storageFromMock).toHaveBeenCalledWith("api-connection-artifacts");
    expect(artifactDownload).toHaveBeenCalledWith(outputRow.rawStoragePath);
    expect(legacyDownload).not.toHaveBeenCalled();
  });

  it("falls back to the legacy dataset bucket for old output paths", async () => {
    const artifactDownload = vi.fn().mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found" },
    });
    const legacyDownload = vi.fn().mockResolvedValue({
      data: new Blob(["{\"rawResponse\":\"legacy\"}"]),
      error: null,
    });
    getDbMock.mockReturnValue(createDbWithOutput(outputRow));
    storageFromMock.mockImplementation((bucket: string) => ({
      download:
        bucket === "api-connection-artifacts" ? artifactDownload : legacyDownload,
    }));

    const { getApiConnectionRunOutputDownload } = await import(
      "@/lib/api-connections"
    );

    const download = await getApiConnectionRunOutputDownload({
      connectionId: "connection-1",
      runId: "run-1",
      format: "json",
    });

    expect(download?.body).toBe("{\"rawResponse\":\"legacy\"}");
    expect(storageFromMock).toHaveBeenNthCalledWith(1, "api-connection-artifacts");
    expect(storageFromMock).toHaveBeenNthCalledWith(2, "datasets");
    expect(artifactDownload).toHaveBeenCalledWith(outputRow.rawStoragePath);
    expect(legacyDownload).toHaveBeenCalledWith(outputRow.rawStoragePath);
  });
});
