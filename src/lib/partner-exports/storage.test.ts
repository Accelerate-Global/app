import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePartnerExportArtifacts,
  downloadPartnerExportArtifact,
  uploadPartnerExportArtifact,
} from "./storage";

const { downloadMock, fromMock, removeMock, uploadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(),
  fromMock: vi.fn(),
  removeMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: fromMock },
  }),
}));

vi.mock("@/lib/dataset-storage", () => ({
  createPartnerExportRunOutputStoragePath: (
    runId: string,
    fileName: string,
  ) => `partner-export-runs/${runId}/${fileName}`,
  getPartnerExportArtifactStorageBucket: () => "partner-export-artifacts",
}));

describe("partner export storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      upload: uploadMock,
      remove: removeMock,
      download: downloadMock,
    });
  });

  it("uploads CSV and JSON only through the private artifact bucket", async () => {
    uploadMock.mockResolvedValue({ error: null });

    await expect(
      uploadPartnerExportArtifact({
        runId: "run-1",
        kind: "csv",
        csvFileName: "Joshua.csv",
        body: "header\r\nvalue\r\n",
      }),
    ).resolves.toBe("partner-export-runs/run-1/Joshua.csv");
    expect(fromMock).toHaveBeenCalledWith("partner-export-artifacts");
    expect(uploadMock).toHaveBeenCalledWith(
      "partner-export-runs/run-1/Joshua.csv",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "text/csv", upsert: false }),
    );
  });

  it("removes unlinked objects and downloads through the server client", async () => {
    removeMock.mockResolvedValue({ error: null });
    downloadMock.mockResolvedValue({
      data: new Blob(["csv"]),
      error: null,
    });

    await deletePartnerExportArtifacts(["one", "two"]);
    await expect(downloadPartnerExportArtifact("one")).resolves.toBeInstanceOf(
      ArrayBuffer,
    );
    expect(removeMock).toHaveBeenCalledWith(["one", "two"]);
  });
});
