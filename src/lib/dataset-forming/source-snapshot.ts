import type {
  ApiConnectionSourceProfileSnapshot,
} from "@/lib/api-types";
import type { SourceProfileSummary } from "@/lib/source-profiles";
import { checksumSourceFormingValue } from "@/lib/source-forming";

import { DatasetFormingError } from "./errors";
import { datasetFormingEngineRegistry } from "./registered-engines";
import type { DatasetFormingEngineShape } from "./registry";

export type ResolvedApiConnectionSourceProfileSnapshot = Readonly<{
  snapshot: ApiConnectionSourceProfileSnapshot;
  checksum: string;
  engine: DatasetFormingEngineShape;
}>;

function invalidSnapshot(message: string): never {
  throw new DatasetFormingError(
    message,
    409,
    "ineligible-source-snapshot",
  );
}

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isChecksum(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

export function createApiConnectionSourceProfileSnapshot(input: {
  connectionId: string;
  sourceProfile: SourceProfileSummary;
}): ResolvedApiConnectionSourceProfileSnapshot {
  const engine = datasetFormingEngineRegistry.requireBySourceProfile(
    input.sourceProfile.key,
  );
  if (engine.engineKey !== input.sourceProfile.engineKey) {
    invalidSnapshot(
      "The source profile does not match its registered forming engine.",
    );
  }
  const snapshot: ApiConnectionSourceProfileSnapshot = {
    schemaVersion: 1,
    connectionId: input.connectionId,
    sourceProfileKey: input.sourceProfile.key,
    sourceProfileLabel: input.sourceProfile.label,
    stableKeyColumn: input.sourceProfile.stableKeyColumn,
    configurable: input.sourceProfile.configurable,
    engineKey: engine.engineKey,
    engineLabel: engine.displayName,
    engineVersion: engine.version,
    engineChecksum: engine.checksum,
    artifactSchemaVersion: engine.artifactSchemaVersion,
    publicationTargetKey: engine.publicationTargetKey,
  };
  return {
    snapshot,
    checksum: checksumSourceFormingValue(snapshot),
    engine,
  };
}

export function resolveApiConnectionSourceProfileSnapshot(input: {
  connectionId: string;
  snapshot: unknown;
  checksum: string | null;
}): ResolvedApiConnectionSourceProfileSnapshot {
  if (!input.snapshot || typeof input.snapshot !== "object" || !input.checksum) {
    invalidSnapshot(
      "This ingestion predates immutable source-profile snapshots. Start a new ingestion first.",
    );
  }
  const snapshot = input.snapshot as Partial<ApiConnectionSourceProfileSnapshot>;
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.connectionId !== input.connectionId ||
    !isNonblankString(snapshot.sourceProfileKey) ||
    !isNonblankString(snapshot.sourceProfileLabel) ||
    !isNonblankString(snapshot.engineKey) ||
    !isNonblankString(snapshot.engineLabel) ||
    !isNonblankString(snapshot.engineVersion) ||
    !isChecksum(snapshot.engineChecksum) ||
    !Number.isSafeInteger(snapshot.artifactSchemaVersion) ||
    (snapshot.artifactSchemaVersion ?? 0) < 1 ||
    !isNonblankString(snapshot.publicationTargetKey) ||
    typeof snapshot.configurable !== "boolean" ||
    !(
      snapshot.stableKeyColumn === null ||
      isNonblankString(snapshot.stableKeyColumn)
    )
  ) {
    invalidSnapshot("The ingestion source-profile snapshot is invalid.");
  }
  const typedSnapshot = snapshot as ApiConnectionSourceProfileSnapshot;
  if (checksumSourceFormingValue(typedSnapshot) !== input.checksum) {
    invalidSnapshot(
      "The ingestion source-profile snapshot checksum is invalid.",
    );
  }
  const engine = datasetFormingEngineRegistry.getByEngineKey(
    typedSnapshot.engineKey,
  );
  if (
    !engine ||
    !engine.sourceProfileKeys.some(
      (profileKey) => profileKey === typedSnapshot.sourceProfileKey,
    ) ||
    engine.version !== typedSnapshot.engineVersion ||
    engine.checksum !== typedSnapshot.engineChecksum ||
    engine.artifactSchemaVersion !== typedSnapshot.artifactSchemaVersion ||
    engine.publicationTargetKey !== typedSnapshot.publicationTargetKey
  ) {
    invalidSnapshot(
      "The deployed forming engine is incompatible with this ingestion snapshot. Start a new ingestion with the current engine.",
    );
  }
  return {
    snapshot: typedSnapshot,
    checksum: input.checksum,
    engine,
  };
}
