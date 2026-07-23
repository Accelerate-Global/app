import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { closeDb } from "@/db";
import {
  activateReferenceResource,
  checkReferenceResourceHealth,
  createPipelineReferenceResourceCandidate,
  getActiveReferenceResource,
  getCurrentReferenceResourceSet,
  ReferenceResourceNotFoundError,
} from "@/lib/reference-resources";
import {
  EXACT_LEGACY_PIPELINE_RESOURCE_FILES,
  parseExactLegacyPipelineResource,
  readExactLegacyPipelineResourceFile,
  type ExactLegacyResourceFile,
} from "@/lib/reference-resources/legacy-import";
import {
  PIPELINE_RESOURCE_KEYS,
  SOURCE_ALIASES_RESOURCE_KEY,
  type PipelineResourceKey,
  type PipelineResourcePayloadByKey,
} from "@/lib/reference-resources/pipeline-types";
import { loadPipelineResourceValidationContext } from "@/lib/reference-resources/validation-context";

import { configureLocalReferenceResourceEnvironment } from "./bootstrap-reference-resources";

const IMPORT_ACTOR = "system:pipeline-reference-resource-import";
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/u;

type ImportManifest = Readonly<{
  resources: Readonly<Record<PipelineResourceKey, ExactLegacyResourceFile>>;
}>;

export type PipelineResourceImportArguments = Readonly<{
  environment: "local" | "remote";
  axDataRoot: string;
  manifestPath: string | null;
}>;

function optionValue(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

export function parsePipelineResourceImportArguments(
  args: readonly string[],
): PipelineResourceImportArguments {
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local === remote) {
    throw new Error("Choose exactly one of --local or --remote.");
  }
  const axDataRoot = optionValue(args, "--ax-data-root");
  if (!axDataRoot) {
    throw new Error("--ax-data-root is required; latest-file discovery is not allowed.");
  }
  return {
    environment: local ? "local" : "remote",
    axDataRoot,
    manifestPath: optionValue(args, "--manifest"),
  };
}

export function parsePipelineResourceImportManifest(value: unknown): ImportManifest {
  const resources =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { resources?: unknown }).resources
      : null;
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) {
    throw new Error("The import manifest must contain a resources object.");
  }
  const resourceObject = resources as Record<string, unknown>;
  const unexpected = Object.keys(resourceObject).filter(
    (key) => !(PIPELINE_RESOURCE_KEYS as readonly string[]).includes(key),
  );
  if (unexpected.length > 0) {
    throw new Error(`The import manifest contains unsupported resources: ${unexpected.join(", ")}.`);
  }
  const parsed = {} as Record<PipelineResourceKey, ExactLegacyResourceFile>;
  for (const resourceKey of PIPELINE_RESOURCE_KEYS) {
    const file = resourceObject[resourceKey];
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new Error(`The import manifest is missing ${resourceKey}.`);
    }
    const record = file as Record<string, unknown>;
    if (
      record.resourceKey !== resourceKey ||
      typeof record.relativePath !== "string" ||
      !record.relativePath.trim() ||
      typeof record.sha256 !== "string" ||
      !CHECKSUM_PATTERN.test(record.sha256) ||
      typeof record.sourceRetrievedAt !== "string" ||
      Number.isNaN(Date.parse(record.sourceRetrievedAt))
    ) {
      throw new Error(`${resourceKey} has an invalid exact file, checksum, or retrieval timestamp.`);
    }
    parsed[resourceKey] = {
      resourceKey,
      relativePath: record.relativePath,
      sha256: record.sha256,
      sourceRetrievedAt: new Date(record.sourceRetrievedAt).toISOString(),
    };
  }
  return { resources: parsed };
}

async function loadManifest(manifestPath: string | null): Promise<ImportManifest> {
  if (!manifestPath) {
    return { resources: EXACT_LEGACY_PIPELINE_RESOURCE_FILES };
  }
  const body = await readFile(manifestPath, "utf8");
  return parsePipelineResourceImportManifest(JSON.parse(body) as unknown);
}

async function activeVersionId(resourceKey: PipelineResourceKey) {
  try {
    return (await getActiveReferenceResource(resourceKey)).version.id;
  } catch (error) {
    if (error instanceof ReferenceResourceNotFoundError) return null;
    throw error;
  }
}

export function exactPipelineCandidateNeedsActivation(
  activeVersionId: string | null,
  candidateVersionId: string,
) {
  return activeVersionId !== candidateVersionId;
}

export async function runExactPipelineReferenceResourceImport(input: {
  axDataRoot: string;
  manifest: ImportManifest;
}) {
  const pinnedValidationSet = await getCurrentReferenceResourceSet();
  if (!pinnedValidationSet?.contentChecksum) {
    throw new Error(
      "Country and ROP resources must be bootstrapped before importing pipeline resources.",
    );
  }

  const files = {} as Record<
    PipelineResourceKey,
    Awaited<ReturnType<typeof readExactLegacyPipelineResourceFile>>
  >;
  for (const resourceKey of PIPELINE_RESOURCE_KEYS) {
    files[resourceKey] = await readExactLegacyPipelineResourceFile({
      axDataRoot: input.axDataRoot,
      file: input.manifest.resources[resourceKey],
    });
  }

  const sourceAliases = parseExactLegacyPipelineResource({
    resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    body: files[SOURCE_ALIASES_RESOURCE_KEY].body,
    sourceRetrievedAt:
      input.manifest.resources[SOURCE_ALIASES_RESOURCE_KEY].sourceRetrievedAt,
  });
  const validation = await loadPipelineResourceValidationContext({
    resourceSetId: pinnedValidationSet.id,
    resourceSetChecksum: pinnedValidationSet.contentChecksum,
    sourceAliases,
  });
  const payloads = {} as {
    [Key in PipelineResourceKey]: PipelineResourcePayloadByKey[Key];
  };
  for (const resourceKey of PIPELINE_RESOURCE_KEYS) {
    payloads[resourceKey] = (resourceKey === SOURCE_ALIASES_RESOURCE_KEY
      ? sourceAliases
      : parseExactLegacyPipelineResource({
          resourceKey,
          body: files[resourceKey].body,
          sourceRetrievedAt:
            input.manifest.resources[resourceKey].sourceRetrievedAt,
          sourceAliases,
          validationContext: validation.context,
        })) as never;
  }

  const candidates = [];
  for (const resourceKey of PIPELINE_RESOURCE_KEYS) {
    const previousActiveVersionId = await activeVersionId(resourceKey);
    const exactFile = input.manifest.resources[resourceKey];
    const candidate = await createPipelineReferenceResourceCandidate({
      resourceKey,
      payload: payloads[resourceKey],
      actorOwnerId: IMPORT_ACTOR,
      validationContext: validation.context,
      rawManifest: {
        operation: "exact-legacy-pipeline-resource-import",
        relativePath: exactFile.relativePath,
        sourceFileChecksum: files[resourceKey].sourceFileChecksum,
        sourceRetrievedAt: exactFile.sourceRetrievedAt,
        validationReferenceSetId: pinnedValidationSet.id,
        validationReferenceSetChecksum: pinnedValidationSet.contentChecksum,
        validationLineage: validation.lineage,
      },
    });
    if (candidate.version.lifecycleState !== "valid") {
      throw new Error(`${resourceKey} exact import produced an invalid candidate.`);
    }
    candidates.push({ resourceKey, previousActiveVersionId, candidate });
  }

  const resources = [];
  for (const item of candidates) {
    const activated = exactPipelineCandidateNeedsActivation(
      item.previousActiveVersionId,
      item.candidate.version.id,
    );
    if (activated) {
      await activateReferenceResource({
        resourceKey: item.resourceKey,
        versionId: item.candidate.version.id,
        expectedActiveVersionId: item.previousActiveVersionId,
        actorOwnerId: IMPORT_ACTOR,
        reason: "Activate checksum-verified AX Data pipeline resource snapshot",
      });
    }
    resources.push({
      resourceKey: item.resourceKey,
      versionId: item.candidate.version.id,
      versionNumber: item.candidate.version.versionNumber,
      checksum: item.candidate.version.contentChecksum,
      entryCount: item.candidate.version.entryCount,
      warningCount: Number(item.candidate.version.validationSummary.warningCount ?? 0),
      unchanged: item.candidate.unchanged && !activated,
      activated,
    });
  }

  const health = await checkReferenceResourceHealth();
  if (!health.healthy) {
    throw new Error(
      `Pipeline resource import health failed: ${health.resources
        .flatMap((resource) =>
          resource.problems.map((problem) => `${resource.resourceKey}:${problem}`),
        )
        .join(", ")}`,
    );
  }
  return { status: "ok" as const, resources, health };
}

async function main() {
  const args = parsePipelineResourceImportArguments(process.argv.slice(2));
  if (args.environment === "local") {
    await configureLocalReferenceResourceEnvironment();
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  try {
    const manifest = await loadManifest(args.manifestPath);
    const result = await runExactPipelineReferenceResourceImport({
      axDataRoot: args.axDataRoot,
      manifest,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeDb();
  }
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
