import { checksumDatasetFormingValue } from "./canonical";
import type { DatasetFormingResourceBinding } from "./types";

export const DATASET_FORMING_INPUT_FINGERPRINT_SCHEMA_VERSION = 2 as const;

export function createDatasetFormingInputFingerprint(input: {
  sourceProfileKey: string;
  sourceRowsChecksum: string;
  sourceRawChecksum: string;
  engineKey: string;
  engineVersion: string;
  engineChecksum: string;
  artifactSchemaVersion: number;
  resourceSetId: string | null;
  resourceSetChecksum: string | null;
  resourceBindings: readonly DatasetFormingResourceBinding[];
  expectedCurrentPublicationId: string | null;
}) {
  return checksumDatasetFormingValue({
    schemaVersion: DATASET_FORMING_INPUT_FINGERPRINT_SCHEMA_VERSION,
    sourceProfileKey: input.sourceProfileKey,
    sourceArtifacts: {
      rowsChecksum: input.sourceRowsChecksum,
      rawChecksum: input.sourceRawChecksum,
    },
    engine: {
      key: input.engineKey,
      version: input.engineVersion,
      checksum: input.engineChecksum,
      artifactSchemaVersion: input.artifactSchemaVersion,
    },
    resourceSet: {
      id: input.resourceSetId,
      checksum: input.resourceSetChecksum,
    },
    resourceBindings: [...input.resourceBindings]
      .sort((left, right) => left.position - right.position)
      .map((binding) => ({
        position: binding.position,
        key: binding.key,
        bindingType: binding.bindingType,
        kind: binding.kind,
        schemaVersion: binding.schemaVersion,
        version: binding.version,
        checksum: binding.checksum,
        resourceId: binding.resourceId,
        resourceVersionId: binding.resourceVersionId,
      })),
    expectedCurrentPublicationId: input.expectedCurrentPublicationId,
  });
}
