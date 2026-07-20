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

type BootstrapDependencies = {
  loadCountry: typeof getGeneratedIsoCountryCodeResourceWithOverrides;
  loadRop: typeof getGeneratedRopCodeResource;
  createCandidate: typeof createReferenceResourceCandidate;
  activate: typeof activateReferenceResource;
  getActive: typeof getActiveReferenceResource;
  health: typeof checkReferenceResourceHealth;
  closeDb: typeof closeDb;
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
  dependencies: BootstrapDependencies;
}) {
  const activeVersionId = await currentVersionId(input.resourceKey, input.dependencies);
  const candidate = (await input.dependencies.createCandidate({
    resourceKey: input.resourceKey,
    payload: input.payload,
    actorOwnerId: BOOTSTRAP_ACTOR,
    rawManifest: {
      operation: "bootstrap-reconcile",
      input: input.resourceKey === COUNTRY_RESOURCE_KEY
        ? "src/data/iso-country-codes.generated.json"
        : "src/data/rop-codes.generated.json",
    },
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

export async function runBootstrapReferenceResources(
  dependencies: BootstrapDependencies = defaultDependencies,
) {
  try {
    const country = await dependencies.loadCountry();
    const rop = dependencies.loadRop();
    const resources = [
      await reconcileResource({
        resourceKey: COUNTRY_RESOURCE_KEY,
        payload: country,
        dependencies,
      }),
      await reconcileResource({
        resourceKey: ROP_RESOURCE_KEY,
        payload: rop,
        dependencies,
      }),
    ];
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
  if (process.argv.includes("--local")) {
    await configureLocalReferenceResourceEnvironment();
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  const result = await runBootstrapReferenceResources();
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
