import { seedFieldSourceRegistryIfNeeded } from "@/lib/field-sources";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const result = await seedFieldSourceRegistryIfNeeded();

  if (result.seeded) {
    console.log(
      "Field source registry seed pass completed from the Aggregate 1 mapping CSV.",
    );
    return;
  }

  console.log("No field-source seed rows were found. Skipping seed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
