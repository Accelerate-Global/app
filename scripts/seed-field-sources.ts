import { pathToFileURL } from "node:url";

import { closeDb } from "@/db";
import { seedFieldSourceRegistryIfNeeded } from "@/lib/field-sources";

type SeedFieldSourcesDependencies = {
  closeDb: typeof closeDb;
  seedFieldSourceRegistryIfNeeded: typeof seedFieldSourceRegistryIfNeeded;
};

const defaultDependencies: SeedFieldSourcesDependencies = {
  closeDb,
  seedFieldSourceRegistryIfNeeded,
};

export async function runSeedFieldSources(
  dependencies: SeedFieldSourcesDependencies = defaultDependencies,
) {
  const { closeDb, seedFieldSourceRegistryIfNeeded } = dependencies;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  try {
    const result = await seedFieldSourceRegistryIfNeeded();

    if (result.seeded) {
      console.log(
        "Field source registry seed pass completed from the mapping and description CSV files.",
      );
      return;
    }

    console.log("No field-source seed rows were found. Skipping seed.");
  } finally {
    await closeDb();
  }
}

async function main() {
  await runSeedFieldSources();
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
