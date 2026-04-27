import { assertOpenSpecArchiveReady } from "./lib/openspec";

async function main() {
  await assertOpenSpecArchiveReady();
  console.log("OpenSpec archive readiness passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
