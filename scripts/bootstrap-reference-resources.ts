import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { closeDb } from "@/db";
import { getGeneratedIsoCountryCodeResourceWithOverrides } from "@/lib/iso-country-codes";
import {
  activateReferenceResource,
  checkReferenceResourceHealth,
  createReferenceResourceCandidate,
  getActiveReferenceResource,
  ReferenceResourceNotFoundError,
} from "@/lib/reference-resources";
import engagementMappingsFixture from "@/lib/reference-resources/fixtures/engagement-mappings.sanitized.json";
import jpPeopleId3Fixture from "@/lib/reference-resources/fixtures/jp-peopleid3.sanitized.json";
import peidFixture from "@/lib/reference-resources/fixtures/peid.sanitized.json";
import sourceAliasesFixture from "@/lib/reference-resources/fixtures/source-aliases.sanitized.json";
import tier1PrioritiesFixture from "@/lib/reference-resources/fixtures/tier1-merge-priorities.sanitized.json";
import {
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  type PipelineResourcePayloadByKey,
  type PipelineResourceValidationContext,
} from "@/lib/reference-resources/pipeline-types";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
  type ReferenceResourceCandidateResult,
  type ReferenceResourceHealth,
  type ReferenceResourceKey,
  type ReferenceResourcePayloadByKey,
} from "@/lib/reference-resources/types";
import { getGeneratedRopCodeResource } from "@/lib/rop-codes";

const execFileAsync = promisify(execFile);
const BOOTSTRAP_ACTOR = "system:reference-resource-bootstrap";

const LOCAL_PIPELINE_SEEDS = [
  {
    resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    payload: sourceAliasesFixture as PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY],
    input: "src/lib/reference-resources/fixtures/source-aliases.sanitized.json",
  },
  {
    resourceKey: JP_PEOPLE_ID3_RESOURCE_KEY,
    payload: jpPeopleId3Fixture as PipelineResourcePayloadByKey[typeof JP_PEOPLE_ID3_RESOURCE_KEY],
    input: "src/lib/reference-resources/fixtures/jp-peopleid3.sanitized.json",
  },
  {
    resourceKey: PEID_RESOURCE_KEY,
    payload: peidFixture as PipelineResourcePayloadByKey[typeof PEID_RESOURCE_KEY],
    input: "src/lib/reference-resources/fixtures/peid.sanitized.json",
  },
  {
    resourceKey: TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
    payload: tier1PrioritiesFixture as PipelineResourcePayloadByKey[typeof TIER1_MERGE_PRIORITIES_RESOURCE_KEY],
    input: "src/lib/reference-resources/fixtures/tier1-merge-priorities.sanitized.json",
  },
  {
    resourceKey: ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
    payload: engagementMappingsFixture as PipelineResourcePayloadByKey[typeof ENGAGEMENT_MAPPINGS_RESOURCE_KEY],
    input: "src/lib/reference-resources/fixtures/engagement-mappings.sanitized.json",
  },
] as const;

type BootstrapDependencies = {
  loadCountry: typeof getGeneratedIsoCountryCodeResourceWithOverrides;
  loadRop: typeof getGeneratedRopCodeResource;
  createCandidate: typeof createReferenceResourceCandidate;
  activate: typeof activateReferenceResource;
  getActive: typeof getActiveReferenceResource;
  health: typeof checkReferenceResourceHealth;
  closeDb: typeof closeDb;
};

type BootstrapResourceResult = {
  resourceKey: ReferenceResourceKey;
  versionId: string;
  versionNumber: number;
  checksum: string | null;
  unchanged: boolean;
  activated: boolean;
  entryCount: number;
};

const defaultDependencies: BootstrapDependencies = {
  loadCountry: getGeneratedIsoCountryCodeResourceWithOverrides,
  loadRop: getGeneratedRopCodeResource,
  createCandidate: createReferenceResourceCandidate,
  activate: activateReferenceResource,
  getActive: getActiveReferenceResource,
  health: checkReferenceResourceHealth,
  closeDb,
};

function parseEnvOutput(output: string) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="(.*)"$/u))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

export async function configureLocalReferenceResourceEnvironment() {
  if (
    process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return;
  }
  const { stdout } = await execFileAsync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
  });
  const values = parseEnvOutput(stdout);
  process.env.DATABASE_URL ??= values.DB_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= values.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??=
    values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY ??= values.SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= values.SERVICE_ROLE_KEY;
}

async function currentVersionId<K extends ReferenceResourceKey>(
  resourceKey: K,
  dependencies: BootstrapDependencies,
) {
  try {
    return (await dependencies.getActive(resourceKey)).version.id;
  } catch (error) {
    if (error instanceof ReferenceResourceNotFoundError) return null;
    throw error;
  }
}

async function reconcileResource<K extends ReferenceResourceKey>(input: {
  resourceKey: K;
  payload: ReferenceResourcePayloadByKey[K];
  sourceInput: string;
  validationContext?: PipelineResourceValidationContext;
  dependencies: BootstrapDependencies;
}) {
  const activeVersionId = await currentVersionId(input.resourceKey, input.dependencies);
  const candidate = (await input.dependencies.createCandidate({
    resourceKey: input.resourceKey,
    payload: input.payload,
    actorOwnerId: BOOTSTRAP_ACTOR,
    rawManifest: {
      operation: "bootstrap-reconcile",
      input: input.sourceInput,
    },
    validationContext: input.validationContext,
  })) as ReferenceResourceCandidateResult;

  let activated = false;
  if (candidate.version.id !== activeVersionId) {
    if (candidate.version.lifecycleState !== "valid") {
      throw new Error(`${input.resourceKey} bootstrap candidate is not valid.`);
    }
    await input.dependencies.activate({
      resourceKey: input.resourceKey,
      versionId: candidate.version.id,
      expectedActiveVersionId: activeVersionId,
      actorOwnerId: BOOTSTRAP_ACTOR,
      reason: activeVersionId ? "Reconcile checked-in reference resource" : "Initial checked-in reference resource bootstrap",
    });
    activated = true;
  }

  return {
    resourceKey: input.resourceKey,
    versionId: candidate.version.id,
    versionNumber: candidate.version.versionNumber,
    checksum: candidate.version.contentChecksum,
    unchanged: candidate.unchanged && !activated,
    activated,
    entryCount: candidate.version.entryCount,
  };
}

function buildPipelineValidationContext(input: {
  country: Awaited<ReturnType<typeof getGeneratedIsoCountryCodeResourceWithOverrides>>;
  rop: ReturnType<typeof getGeneratedRopCodeResource>;
  sourceAliases: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY];
}): PipelineResourceValidationContext {
  return {
    knownIso3Codes: new Set(
      input.country.entries.flatMap((entry) =>
        [entry.primaryAlpha3, entry.officialIsoAlpha3, entry.gencAlpha3]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.toUpperCase()),
      ),
    ),
    knownRop3Codes: new Set(Object.keys(input.rop.rop3DetailsByCode)),
    knownRop1Codes: new Set(Object.keys(input.rop.rop1DetailsByCode)),
    knownSourceKeys: new Set(
      input.sourceAliases.entries.map((entry) => entry.canonicalSourceKey),
    ),
    activeSourceKeys: new Set(
      input.sourceAliases.entries
        .filter((entry) => entry.active)
        .map((entry) => entry.canonicalSourceKey),
    ),
  };
}

export function runBootstrapReferenceResources(
  dependencies?: BootstrapDependencies,
  options?: { includeLocalPipelineSeeds?: boolean; skipHealth?: false },
): Promise<{
  status: "ok";
  resources: BootstrapResourceResult[];
  health: ReferenceResourceHealth;
}>;
export function runBootstrapReferenceResources(
  dependencies: BootstrapDependencies,
  options: { includeLocalPipelineSeeds?: boolean; skipHealth: true },
): Promise<{
  status: "ok";
  resources: BootstrapResourceResult[];
  health: null;
}>;
export async function runBootstrapReferenceResources(
  dependencies: BootstrapDependencies = defaultDependencies,
  options: { includeLocalPipelineSeeds?: boolean; skipHealth?: boolean } = {},
) {
  try {
    const country = await dependencies.loadCountry();
    const rop = dependencies.loadRop();
    const resources: BootstrapResourceResult[] = [
      await reconcileResource({
        resourceKey: COUNTRY_RESOURCE_KEY,
        payload: country,
        sourceInput: "src/data/iso-country-codes.generated.json",
        dependencies,
      }),
      await reconcileResource({
        resourceKey: ROP_RESOURCE_KEY,
        payload: rop,
        sourceInput: "src/data/rop-codes.generated.json",
        dependencies,
      }),
    ];
    if (options.includeLocalPipelineSeeds) {
      const validationContext = buildPipelineValidationContext({
        country,
        rop,
        sourceAliases: sourceAliasesFixture as PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY],
      });
      for (const seed of LOCAL_PIPELINE_SEEDS) {
        resources.push(
          await reconcileResource({
            resourceKey: seed.resourceKey,
            payload: seed.payload as never,
            sourceInput: seed.input,
            validationContext,
            dependencies,
          }),
        );
      }
    }
    if (options.skipHealth) {
      return { status: "ok" as const, resources, health: null };
    }
    const health = (await dependencies.health()) as ReferenceResourceHealth;
    if (!health.healthy) {
      throw new Error(
        `Reference-resource bootstrap health failed: ${health.resources
          .flatMap((resource) => resource.problems.map((problem) => `${resource.resourceKey}:${problem}`))
          .join(", ")}`,
      );
    }
    return { status: "ok" as const, resources, health };
  } finally {
    await dependencies.closeDb();
  }
}

async function main() {
  const local = process.argv.includes("--local");
  if (local) {
    await configureLocalReferenceResourceEnvironment();
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  const coreOnly = process.argv.includes("--core-only");
  const result = coreOnly
    ? await runBootstrapReferenceResources(defaultDependencies, {
        includeLocalPipelineSeeds: local,
        skipHealth: true,
      })
    : await runBootstrapReferenceResources(defaultDependencies, {
        includeLocalPipelineSeeds: local,
      });
  console.log(JSON.stringify(result, null, 2));
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
