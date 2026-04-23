import { rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runCommand } from "./lib/command";

const generatedTypeDirectories = [
  path.join(".next", "types"),
  path.join(".next", "dev", "types"),
] as const;

export async function runTypecheck() {
  for (const directoryPath of generatedTypeDirectories) {
    await rm(path.join(process.cwd(), directoryPath), {
      recursive: true,
      force: true,
    });
  }

  await runCommand("pnpm", ["exec", "next", "typegen"], {
    stdinMode: "ignore",
  });
  await runCommand("pnpm", ["exec", "tsc", "--noEmit"], {
    stdinMode: "ignore",
  });

  console.log("typecheck passed.");
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  runTypecheck().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
