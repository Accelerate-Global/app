import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createPipelineArtifactStoragePath,
  deletePipelineArtifacts,
  deletePipelineDatasetBlob,
  readPipelineArtifact,
  uploadPipelineArtifact,
  uploadPipelineDatasetBlob,
} from "./storage";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const upload = vi.fn();
const download = vi.fn();
const remove = vi.fn();
const from = vi.fn(() => ({ upload, download, remove }));

describe("pipeline product storage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ storage: { from } } as never);
  });

  it("creates private deterministic artifact paths", () => {
    expect(createPipelineArtifactStoragePath({ definitionKey: "tier1-pgic-merge", runId: "run-1", kind: "rows-json" }))
      .toBe("pipeline-products/tier1-pgic-merge/run-1/rows-json.json");
    expect(() => createPipelineArtifactStoragePath({ definitionKey: "../bad", runId: "run-1", kind: "rows-json" }))
      .toThrow("Invalid pipeline definition key");
  });

  it("uploads and reads immutable artifacts", async () => {
    upload.mockResolvedValue({ error: null });
    download.mockResolvedValue({ data: { text: () => Promise.resolve("[]") }, error: null });
    await expect(uploadPipelineArtifact({ definitionKey: "tier1-pgic-merge", runId: "run-1", kind: "rows-json", body: "[]" }))
      .resolves.toContain("rows-json.json");
    await expect(readPipelineArtifact("pipeline-products/x/run/rows-json.json")).resolves.toBe("[]");
    expect(upload).toHaveBeenCalledWith(expect.any(String), expect.any(Uint8Array), expect.objectContaining({ upsert: false }));
  });

  it("cleans up prepared artifacts after a failed build", async () => {
    remove.mockResolvedValue({ error: null });
    await deletePipelineArtifacts(["one", "two"]);
    expect(remove).toHaveBeenCalledWith(["one", "two"]);
  });

  it("stores publishable CSV in the private dataset bucket and can compensate", async () => {
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    const path = await uploadPipelineDatasetBlob({ fileName: "Tier 1.csv", csv: "a\r\n1\r\n" });
    expect(path).toContain("datasets/csv/");
    await deletePipelineDatasetBlob(path);
    expect(remove).toHaveBeenCalledWith([path]);
  });

  it("uploads to a pre-reserved path so a crashed attempt remains recoverable", async () => {
    upload.mockResolvedValue({ error: null });
    await expect(uploadPipelineDatasetBlob({
      fileName: "Tier 1.csv",
      csv: "a\r\n1\r\n",
      storagePath: "datasets/csv/reserved-tier-1.csv",
    })).resolves.toBe("datasets/csv/reserved-tier-1.csv");
    expect(upload).toHaveBeenCalledWith(
      "datasets/csv/reserved-tier-1.csv",
      expect.any(Uint8Array),
      expect.objectContaining({ upsert: false }),
    );
  });
});
