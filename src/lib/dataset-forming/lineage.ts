import type {
  DatasetFormingContext,
  DatasetFormingEngineDeclaration,
  DatasetFormingLineageManifest,
  DatasetFormingResult,
  DatasetFormingValidationCounts,
} from "./types";

export function createDatasetFormingLineageManifest<
  TResources,
  TValidation extends DatasetFormingValidationCounts,
>(input: {
  context: DatasetFormingContext<TResources>;
  engine: DatasetFormingEngineDeclaration;
  result: DatasetFormingResult<TValidation>;
  inputFingerprint: string;
}): DatasetFormingLineageManifest<TValidation> {
  return {
    schemaVersion: 1,
    connectionId: input.context.connectionId,
    sourceProfileKey: input.context.sourceProfileKey,
    sourceRunId: input.context.sourceRunId,
    sourceRowsChecksum: input.context.sourceArtifacts.rowsChecksum,
    sourceRawChecksum: input.context.sourceArtifacts.rawChecksum,
    inputFingerprint: input.inputFingerprint,
    engineKey: input.engine.engineKey,
    engineVersion: input.engine.version,
    engineChecksum: input.engine.checksum,
    artifactSchemaVersion: input.engine.artifactSchemaVersion,
    publicationTargetKey: input.engine.publicationTargetKey,
    resourceBindings: [...input.context.resourceBindings],
    inputRowCount: input.context.rows.length,
    outputRowCount: input.result.rows.length,
    outputChecksum: input.result.outputChecksum,
    columns: input.result.columns,
    validation: input.result.validation,
  };
}
