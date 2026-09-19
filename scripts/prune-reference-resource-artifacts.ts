import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import { referenceResources, referenceResourceVersions } from "@/db/schema";
import { getReferenceResourceArtifactStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { configureLocalReferenceResourceEnvironment } from "./bootstrap-reference-resources";

type ArtifactPruneOptions = {
  resourceKey: string;
  expectedKind: string;
  prefix: string;
  apply: boolean;
  local: boolean;
};

type ArtifactPruneDependencies = {
  loadResource: (resourceKey: string) => Promise<{
    kind: string;
    manifests: Array<Record<string, string>>;
  } | null>;
  listPaths: (prefix: string) => Promise<string[]>;
  removePaths: (paths: string[]) => Promise<void>;
};

export type ArtifactPrunePlan = {
  resourceKey: string;
  kind: string;
  prefix: string;
  paths: string[];
};

function requiredValue(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseArtifactPruneArgs(argv: string[]): ArtifactPruneOptions {
  const prefix = requiredValue(argv, "--prefix").replace(/^\/+|\/+$/gu, "");
  if (!prefix || !prefix.includes("/")) {
    throw new Error("--prefix must be a specific, non-root Storage prefix.");
  }

  return {
    resourceKey: requiredValue(argv, "--resource-key"),
    expectedKind: requiredValue(argv, "--expected-kind"),
    prefix,
    apply: argv.includes("--apply"),
    local: argv.includes("--local"),
  };
}

function comparePathSets(expected: string[], actual: string[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((path) => !actualSet.has(path));
  const unexpected = actual.filter((path) => !expectedSet.has(path));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Storage drift detected (missing=${missing.length}, unexpected=${unexpected.length}).`,
    );
  }
}

export async function buildArtifactPrunePlan(
  options: ArtifactPruneOptions,
  dependencies: ArtifactPruneDependencies,
): Promise<ArtifactPrunePlan> {
  const resource = await dependencies.loadResource(options.resourceKey);
  if (!resource) throw new Error("Reference resource was not found.");
  if (resource.kind !== options.expectedKind) {
    throw new Error("Reference resource kind does not match --expected-kind.");
  }

  const paths = resource.manifests
    .flatMap((manifest) => Object.values(manifest))
    .sort();
  if (paths.length === 0) throw new Error("Reference resource has no artifact paths.");
  if (new Set(paths).size !== paths.length) {
    throw new Error("Reference resource manifests contain duplicate artifact paths.");
  }
  if (paths.length > 1000) {
    throw new Error("Refusing to remove more than 1000 Storage objects in one operation.");
  }
  if (paths.some((path) => !path.startsWith(`${options.prefix}/`))) {
    throw new Error("A manifest path falls outside the approved Storage prefix.");
  }

  const actualPaths = (await dependencies.listPaths(options.prefix)).sort();
  comparePathSets(paths, actualPaths);
  return {
    resourceKey: options.resourceKey,
    kind: resource.kind,
    prefix: options.prefix,
    paths,
  };
}

export async function executeArtifactPrune(
  options: ArtifactPruneOptions,
  dependencies: ArtifactPruneDependencies,
) {
  const plan = await buildArtifactPrunePlan(options, dependencies);
  if (!options.apply) return { mode: "dry-run" as const, plan };

  await dependencies.removePaths(plan.paths);
  const remaining = await dependencies.listPaths(plan.prefix);
  if (remaining.length > 0) {
    throw new Error(`Storage cleanup verification failed (${remaining.length} objects remain).`);
  }
  return { mode: "applied" as const, plan };
}

async function listStoragePaths(prefix: string) {
  const storage = createSupabaseAdminClient().storage.from(
    getReferenceResourceArtifactStorageBucket(),
  );
  const paths: string[] = [];

  async function visit(currentPrefix: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await storage.list(currentPrefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("Could not list reference-resource artifacts.");
      for (const item of data ?? []) {
        const path = `${currentPrefix}/${item.name}`;
        if (item.id === null) await visit(path);
        else paths.push(path);
      }
      if (!data || data.length < 100) break;
      offset += data.length;
    }
  }

  await visit(prefix);
  return paths;
}

const defaultDependencies: ArtifactPruneDependencies = {
  async loadResource(resourceKey) {
    const [resource] = await getDb()
      .select({ id: referenceResources.id, kind: referenceResources.resourceKind })
      .from(referenceResources)
      .where(eq(referenceResources.resourceKey, resourceKey))
      .limit(2);
    if (!resource) return null;
    const versions = await getDb()
      .select({ manifest: referenceResourceVersions.artifactManifest })
      .from(referenceResourceVersions)
      .where(eq(referenceResourceVersions.resourceId, resource.id));
    return { kind: resource.kind, manifests: versions.map((version) => version.manifest) };
  },
  listPaths: listStoragePaths,
  async removePaths(paths) {
    const { error } = await createSupabaseAdminClient()
      .storage.from(getReferenceResourceArtifactStorageBucket())
      .remove(paths);
    if (error) throw new Error("Could not remove reference-resource artifacts.");
  },
};

export async function runArtifactPrune(argv = process.argv.slice(2)) {
  const options = parseArtifactPruneArgs(argv);
  if (options.local) await configureLocalReferenceResourceEnvironment();
  try {
    const result = await executeArtifactPrune(options, defaultDependencies);
    process.stdout.write(`${JSON.stringify({
      mode: result.mode,
      resourceKey: result.plan.resourceKey,
      kind: result.plan.kind,
      prefix: result.plan.prefix,
      objectCount: result.plan.paths.length,
      paths: result.plan.paths,
    }, null, 2)}\n`);
  } finally {
    await closeDb();
  }
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (isEntrypoint) {
  void runArtifactPrune().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Artifact cleanup failed."}\n`);
    process.exitCode = 1;
  });
}
