import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatasetFormingArtifactStoragePath,
  uploadDatasetFormingArtifact,
} from "./storage";

const { fromMock, uploadMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: fromMock },
  }),
}));

vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));

describe("dataset forming artifact storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upload: uploadMock });
  });

  it("preserves the existing IMB artifact path exactly", () => {
    expect(
      createDatasetFormingArtifactStoragePath({
        engineKey: "imb",
        sourceRunId: "source-run",
        formingRunId: "forming-run",
        kind: "csv",
      }),
    ).toBe("imb-forming-runs/source-run/forming-run/csv.csv");
  });

  it("names non-IMB artifacts by stable engine and run identity", async () => {
    await expect(
      uploadDatasetFormingArtifact({
        engineKey: "joshua-project",
        sourceRunId: "source-run",
        formingRunId: "forming-run",
        kind: "manifest",
        body: "{}",
      }),
    ).resolves.toBe(
      "dataset-forming-runs/joshua-project/source-run/forming-run/manifest.json",
    );
    expect(uploadMock).toHaveBeenCalledWith(
      "dataset-forming-runs/joshua-project/source-run/forming-run/manifest.json",
      expect.any(Uint8Array),
      { contentType: "application/json", upsert: false },
    );
  });

  it("rejects unsafe path segments", () => {
    expect(() =>
      createDatasetFormingArtifactStoragePath({
        engineKey: "../outside",
        sourceRunId: "source-run",
        formingRunId: "forming-run",
        kind: "rows",
      }),
    ).toThrow("Invalid dataset forming engine key");
  });
});
