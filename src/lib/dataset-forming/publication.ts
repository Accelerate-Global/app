import type { DatasetFormingArtifactManifest } from "./types";

export const DATASET_FORMING_PUBLICATION_ROW_BATCH_SIZE = 2_000;

export type DatasetFormingPublicationManifest = {
  schemaVersion: number;
  formingRunId: string;
  sourceRunId: string;
  resourceSetId: string;
  inputFingerprint: string;
  artifacts: DatasetFormingArtifactManifest;
};

export type DatasetFormingPublicationTargetEvidence = Readonly<{
  publicationId: string;
  producerKind: string;
  sourceProfileKey: string | null;
  publicationTargetKey: string | null;
  producerDefinitionKey: string | null;
  datasetId: string;
  publicationRowCount: number;
  datasetRowCount: number;
  datasetStatus: string;
}>;

export function resolveDatasetFormingTargetDataset(input: {
  expectedCurrentPublicationId: string | null;
  expectedSourceProfileKey: string;
  expectedPublicationTargetKey: string;
  expectedProducerDefinitionKey: string;
  connectionTargetDatasetId: string | null;
  currentPublication: DatasetFormingPublicationTargetEvidence | null;
}) {
  if (!input.expectedCurrentPublicationId) {
    return input.connectionTargetDatasetId;
  }
  const publication = input.currentPublication;
  if (
    !publication ||
    publication.publicationId !== input.expectedCurrentPublicationId ||
    publication.producerKind !== "dataset-forming" ||
    publication.sourceProfileKey !== input.expectedSourceProfileKey ||
    publication.publicationTargetKey !== input.expectedPublicationTargetKey ||
    publication.producerDefinitionKey !== input.expectedProducerDefinitionKey ||
    !publication.datasetId ||
    publication.datasetStatus !== "ready" ||
    publication.publicationRowCount !== publication.datasetRowCount ||
    (input.connectionTargetDatasetId !== null &&
      input.connectionTargetDatasetId !== publication.datasetId)
  ) {
    throw new Error(
      "The pinned source publication no longer matches its stable dataset target.",
    );
  }
  return publication.datasetId;
}

export function createDatasetFormingPublicationManifest(
  input: DatasetFormingPublicationManifest,
) {
  return {
    schemaVersion: input.schemaVersion,
    formingRunId: input.formingRunId,
    sourceRunId: input.sourceRunId,
    resourceSetId: input.resourceSetId,
    inputFingerprint: input.inputFingerprint,
    artifacts: { ...input.artifacts },
  } satisfies DatasetFormingPublicationManifest;
}

export function createDatasetFormingPublicationRowBatches<TRow>(
  rows: readonly TRow[],
  batchSize = DATASET_FORMING_PUBLICATION_ROW_BATCH_SIZE,
) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("The publication row batch size must be a positive integer.");
  }
  const batches: Array<{ offset: number; rows: TRow[] }> = [];
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    batches.push({ offset, rows: rows.slice(offset, offset + batchSize) });
  }
  return batches;
}
