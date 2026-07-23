import { describe, expect, it } from "vitest";

import {
  createDatasetFormingPublicationManifest,
  createDatasetFormingPublicationRowBatches,
  resolveDatasetFormingTargetDataset,
} from "./publication";

describe("dataset forming publication", () => {
  it("retains the immutable formed-source lineage needed downstream", () => {
    expect(
      createDatasetFormingPublicationManifest({
        schemaVersion: 1,
        formingRunId: "forming-1",
        sourceRunId: "source-1",
        resourceSetId: "resources-1",
        inputFingerprint: "a".repeat(64),
        artifacts: { rows: "runs/forming-1/rows.json" },
      }),
    ).toEqual({
      schemaVersion: 1,
      formingRunId: "forming-1",
      sourceRunId: "source-1",
      resourceSetId: "resources-1",
      inputFingerprint: "a".repeat(64),
      artifacts: { rows: "runs/forming-1/rows.json" },
    });
  });

  it("batches a large immutable row archive without changing row order", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ index }));
    expect(createDatasetFormingPublicationRowBatches(rows, 2)).toEqual([
      { offset: 0, rows: [{ index: 0 }, { index: 1 }] },
      { offset: 2, rows: [{ index: 2 }, { index: 3 }] },
      { offset: 4, rows: [{ index: 4 }] },
    ]);
  });

  it("rejects an invalid row batch size", () => {
    expect(() => createDatasetFormingPublicationRowBatches([], 0)).toThrow(
      /positive integer/u,
    );
  });

  it("reuses the stable published dataset after a source connection is replaced", () => {
    expect(resolveDatasetFormingTargetDataset({
      expectedCurrentPublicationId: "publication-1",
      expectedSourceProfileKey: "wcd-people-groups",
      expectedPublicationTargetKey: "source-wcd-people-groups",
      expectedProducerDefinitionKey: "wcd",
      connectionTargetDatasetId: null,
      currentPublication: {
        publicationId: "publication-1",
        producerKind: "dataset-forming",
        sourceProfileKey: "wcd-people-groups",
        publicationTargetKey: "source-wcd-people-groups",
        producerDefinitionKey: "wcd",
        datasetId: "stable-dataset-1",
        publicationRowCount: 15,
        datasetRowCount: 15,
        datasetStatus: "ready",
      },
    })).toBe("stable-dataset-1");
  });

  it("fails closed when a reconnected source points at a different dataset", () => {
    expect(() => resolveDatasetFormingTargetDataset({
      expectedCurrentPublicationId: "publication-1",
      expectedSourceProfileKey: "wcd-people-groups",
      expectedPublicationTargetKey: "source-wcd-people-groups",
      expectedProducerDefinitionKey: "wcd",
      connectionTargetDatasetId: "duplicate-dataset",
      currentPublication: {
        publicationId: "publication-1",
        producerKind: "dataset-forming",
        sourceProfileKey: "wcd-people-groups",
        publicationTargetKey: "source-wcd-people-groups",
        producerDefinitionKey: "wcd",
        datasetId: "stable-dataset-1",
        publicationRowCount: 15,
        datasetRowCount: 15,
        datasetStatus: "ready",
      },
    })).toThrow("stable dataset target");
  });
});
