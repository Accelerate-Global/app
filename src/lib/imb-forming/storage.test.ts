import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/error-logging";

import { uploadImbFormingArtifact } from "./storage";

const { fromMock, uploadMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: fromMock },
  }),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

describe("IMB forming artifact storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({ upload: uploadMock });
  });

  it("uploads CSV artifacts to the private API connection artifact bucket", async () => {
    uploadMock.mockResolvedValue({ error: null });

    await expect(
      uploadImbFormingArtifact({
        sourceRunId: "source-run",
        formingRunId: "forming-run",
        kind: "csv",
        body: "name\r\nAlpha\r\n",
      }),
    ).resolves.toBe("imb-forming-runs/source-run/forming-run/csv.csv");

    expect(fromMock).toHaveBeenCalledWith("api-connection-artifacts");
    expect(uploadMock).toHaveBeenCalledWith(
      "imb-forming-runs/source-run/forming-run/csv.csv",
      expect.any(Uint8Array),
      {
        contentType: "text/csv; charset=utf-8",
        upsert: false,
      },
    );
  });

  it("uses the shared engine-aware artifact layout without changing legacy IMB paths", async () => {
    uploadMock.mockResolvedValue({ error: null });

    await uploadImbFormingArtifact({
      sourceRunId: "source-run",
      formingRunId: "forming-run",
      kind: "manifest",
      body: "{}",
    });

    expect(uploadMock).toHaveBeenCalledOnce();
    const [path, body, options] = uploadMock.mock.calls[0];
    expect(path).toBe("imb-forming-runs/source-run/forming-run/manifest.json");
    expect(Buffer.from(body).toString("utf8")).toBe("{}");
    expect(options).toEqual({
      contentType: "application/json",
      upsert: false,
    });
  });

  it("logs normalized provider context and keeps the user-facing error safe", async () => {
    const providerError = {
      message: "mime type text/csv is not supported",
      status: 400,
    };
    uploadMock.mockResolvedValue({ error: providerError });

    await expect(
      uploadImbFormingArtifact({
        sourceRunId: "source-run",
        formingRunId: "forming-run",
        kind: "csv",
        body: "name\r\nAlpha\r\n",
      }),
    ).rejects.toThrow("Could not store IMB forming csv artifact.");

    expect(logError).toHaveBeenCalledWith(
      "Failed to store IMB forming csv artifact",
      providerError,
    );
  });
});
