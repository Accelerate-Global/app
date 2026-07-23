import { DatasetFormingError } from "./errors";
import type { DatasetFormingEngineDeclaration } from "./types";
import { isDatasetFormingChecksum } from "./types";

export type DatasetFormingEngineShape = DatasetFormingEngineDeclaration & {
  form: (...args: never[]) => unknown;
};

export type DatasetFormingEngineResolution<T extends DatasetFormingEngineShape> =
  | { status: "registered"; sourceProfileKey: string; engine: T }
  | { status: "unsupported"; sourceProfileKey: string }
  | {
      status: "ambiguous";
      sourceProfileKey: string;
      engineKeys: string[];
    };

function assertNonblank(value: string, field: string, engineKey: string) {
  if (!value.trim()) {
    throw new DatasetFormingError(
      `Dataset forming engine ${engineKey || "(unknown)"} has no ${field}.`,
      500,
      "invalid-engine-declaration",
      { engineKey, field },
    );
  }
}

export function assertValidDatasetFormingEngineDeclaration(
  engine: DatasetFormingEngineShape,
) {
  assertNonblank(engine.engineKey, "engine key", engine.engineKey);
  assertNonblank(engine.displayName, "display name", engine.engineKey);
  assertNonblank(engine.version, "version", engine.engineKey);
  assertNonblank(
    engine.publicationTargetKey,
    "publication target key",
    engine.engineKey,
  );
  if (!isDatasetFormingChecksum(engine.checksum)) {
    throw new DatasetFormingError(
      `Dataset forming engine ${engine.engineKey} has an invalid checksum.`,
      500,
      "invalid-engine-declaration",
      { engineKey: engine.engineKey, field: "checksum" },
    );
  }
  if (!Number.isSafeInteger(engine.artifactSchemaVersion) || engine.artifactSchemaVersion < 1) {
    throw new DatasetFormingError(
      `Dataset forming engine ${engine.engineKey} has an invalid artifact schema version.`,
      500,
      "invalid-engine-declaration",
      { engineKey: engine.engineKey, field: "artifactSchemaVersion" },
    );
  }
  if (engine.sourceProfileKeys.length === 0) {
    throw new DatasetFormingError(
      `Dataset forming engine ${engine.engineKey} has no source profiles.`,
      500,
      "invalid-engine-declaration",
      { engineKey: engine.engineKey, field: "sourceProfileKeys" },
    );
  }

  const profileKeys = new Set<string>();
  for (const sourceProfileKey of engine.sourceProfileKeys) {
    assertNonblank(sourceProfileKey, "source profile key", engine.engineKey);
    if (profileKeys.has(sourceProfileKey)) {
      throw new DatasetFormingError(
        `Dataset forming engine ${engine.engineKey} repeats source profile ${sourceProfileKey}.`,
        500,
        "invalid-engine-declaration",
        { engineKey: engine.engineKey, sourceProfileKey },
      );
    }
    profileKeys.add(sourceProfileKey);
  }

  const requirementKeys = new Set<string>();
  for (const requirement of engine.resourceRequirements) {
    assertNonblank(requirement.key, "resource requirement key", engine.engineKey);
    if (requirementKeys.has(requirement.key)) {
      throw new DatasetFormingError(
        `Dataset forming engine ${engine.engineKey} repeats resource requirement ${requirement.key}.`,
        500,
        "invalid-engine-declaration",
        { engineKey: engine.engineKey, requirementKey: requirement.key },
      );
    }
    requirementKeys.add(requirement.key);

    if (requirement.bindingType === "catalog") {
      if (
        !requirement.expectedKind.trim() ||
        requirement.compatibleSchemaVersions.length === 0 ||
        requirement.compatibleSchemaVersions.some(
          (version) => !Number.isSafeInteger(version) || version < 1,
        )
      ) {
        throw new DatasetFormingError(
          `Dataset forming engine ${engine.engineKey} has an invalid catalog requirement ${requirement.key}.`,
          500,
          "invalid-engine-declaration",
          { engineKey: engine.engineKey, requirementKey: requirement.key },
        );
      }
      continue;
    }

    if (
      !requirement.contractType.trim() ||
      !requirement.version.trim() ||
      !Number.isSafeInteger(requirement.schemaVersion) ||
      requirement.schemaVersion < 1 ||
      !isDatasetFormingChecksum(requirement.checksum)
    ) {
      throw new DatasetFormingError(
        `Dataset forming engine ${engine.engineKey} has an invalid code requirement ${requirement.key}.`,
        500,
        "invalid-engine-declaration",
        { engineKey: engine.engineKey, requirementKey: requirement.key },
      );
    }
  }
}

export class DatasetFormingEngineRegistry<
  T extends DatasetFormingEngineShape = DatasetFormingEngineShape,
> {
  readonly #engines: readonly T[];
  readonly #byEngineKey = new Map<string, T>();
  readonly #bySourceProfileKey = new Map<string, T[]>();

  constructor(engines: readonly T[]) {
    this.#engines = [...engines];
    for (const engine of this.#engines) {
      assertValidDatasetFormingEngineDeclaration(engine);
      if (this.#byEngineKey.has(engine.engineKey)) {
        throw new DatasetFormingError(
          `Dataset forming engine key ${engine.engineKey} is registered more than once.`,
          500,
          "duplicate-engine-key",
          { engineKey: engine.engineKey },
        );
      }
      this.#byEngineKey.set(engine.engineKey, engine);
      for (const sourceProfileKey of engine.sourceProfileKeys) {
        this.#bySourceProfileKey.set(sourceProfileKey, [
          ...(this.#bySourceProfileKey.get(sourceProfileKey) ?? []),
          engine,
        ]);
      }
    }
  }

  list() {
    return [...this.#engines];
  }

  getByEngineKey(engineKey: string) {
    return this.#byEngineKey.get(engineKey) ?? null;
  }

  resolveBySourceProfile(
    sourceProfileKey: string,
  ): DatasetFormingEngineResolution<T> {
    const engines = this.#bySourceProfileKey.get(sourceProfileKey) ?? [];
    if (engines.length === 0) {
      return { status: "unsupported", sourceProfileKey };
    }
    if (engines.length > 1) {
      return {
        status: "ambiguous",
        sourceProfileKey,
        engineKeys: engines.map((engine) => engine.engineKey).sort(),
      };
    }
    return { status: "registered", sourceProfileKey, engine: engines[0]! };
  }

  requireBySourceProfile(sourceProfileKey: string) {
    const resolution = this.resolveBySourceProfile(sourceProfileKey);
    if (resolution.status === "unsupported") {
      throw new DatasetFormingError(
        `No dataset forming engine is registered for source profile ${sourceProfileKey}.`,
        404,
        "unsupported-source-profile",
        { sourceProfileKey },
      );
    }
    if (resolution.status === "ambiguous") {
      throw new DatasetFormingError(
        `Source profile ${sourceProfileKey} maps to more than one dataset forming engine.`,
        409,
        "ambiguous-source-profile",
        {
          sourceProfileKey,
          engineKeys: resolution.engineKeys,
        },
      );
    }
    return resolution.engine;
  }
}

export function createDatasetFormingEngineRegistry<
  const T extends DatasetFormingEngineShape,
>(engines: readonly T[]) {
  return new DatasetFormingEngineRegistry(engines);
}
