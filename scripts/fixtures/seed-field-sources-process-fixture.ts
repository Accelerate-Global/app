import { runSeedFieldSources } from "../seed-field-sources";

let keepAlive: ReturnType<typeof setInterval> | null = null;

process.env.DATABASE_URL ??= "postgresql://example.com/postgres";

async function main() {
  await runSeedFieldSources({
    async closeDb() {
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
    },
    async seedFieldSourceRegistryIfNeeded() {
      keepAlive = setInterval(() => {}, 1_000);
      return {
        seeded: true,
      };
    },
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
