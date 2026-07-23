import { beforeEach, describe, expect, it, vi } from "vitest";

import { deletePipelineArtifacts, uploadPipelineArtifact } from "./storage";
import { getPipelineDefinition } from "./definitions";
import { getPipelineOutputColumns, persistPipelineArtifacts } from "./artifacts";

vi.mock("./storage", () => ({
  uploadPipelineArtifact: vi.fn(),
  deletePipelineArtifacts: vi.fn(),
}));

describe("pipeline product artifacts", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds stable columns across sparse rows", () => {
    expect(getPipelineOutputColumns([{ b: "2" }, { a: "1" }])).toEqual([
      { key: "a", label: "a", sourceIndex: 0 },
      { key: "b", label: "b", sourceIndex: 1 },
    ]);
  });

  it("persists rows, findings, and exact lineage", async () => {
    vi.mocked(uploadPipelineArtifact).mockImplementation(async (input) => `path/${input.kind}`);
    const persisted = await persistPipelineArtifacts({
      definition: getPipelineDefinition("aggregate1-south-asia"),
      runId: "run-1",
      inputs: [{ inputKey: "aggregate1-pgac", publicationId: "pub-1", outputChecksum: "a".repeat(64), rowCount: 1, registryRevisionId: "rev-1" }],
      rows: [{ Geo_Country_Name: "India" }],
      findings: [],
    });
    expect(persisted.manifest.artifacts.map((artifact) => artifact.kind)).toEqual([
      "rows-json",
      "rows-csv",
      "findings-json",
      "lineage-json",
    ]);
    const lineageCall = vi.mocked(uploadPipelineArtifact).mock.calls
      .find(([input]) => input.kind === "lineage-json");
    expect(JSON.parse(lineageCall![0].body)).toMatchObject({
      definitionIsWorkspaceVisible: true,
      definitionSemanticContract: {
        version: "aggregate1-south-asia-semantics-v1",
        externalBindings: ["aggregate1-pgac", "south-asia-scope"],
      },
    });
  });

  it("removes previously uploaded artifacts when a later upload fails", async () => {
    vi.mocked(uploadPipelineArtifact)
      .mockResolvedValueOnce("path/rows-json")
      .mockRejectedValueOnce(new Error("storage failed"));
    await expect(persistPipelineArtifacts({
      definition: getPipelineDefinition("aggregate1-south-asia"),
      runId: "run-1",
      inputs: [],
      rows: [],
      findings: [],
    })).rejects.toThrow("storage failed");
    expect(deletePipelineArtifacts).toHaveBeenCalledWith(["path/rows-json"]);
  });
});
