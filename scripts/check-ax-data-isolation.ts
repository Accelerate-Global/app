import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXECUTABLE_ROOTS = ["src", "scripts", "config"] as const;
const EXECUTABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
const SELF = "scripts/check-ax-data-isolation.ts";
const BANNED_MARKERS = [
  ["--ax", "-data-root"].join(""),
  ["AX", "_DATA_ROOT"].join(""),
  ["../", "data"].join(""),
  ["identity-registry/", "importer"].join(""),
  ["import-legacy-ax", "-identity-graph"].join(""),
  ["import-pipeline", "-reference-resources"].join(""),
] as const;

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(child)));
    else if (EXECUTABLE_EXTENSIONS.has(path.extname(entry.name))) files.push(child);
  }
  return files;
}

export async function findAxDataExecutionDependencies(cwd = process.cwd()) {
  const relativeFiles = (
    await Promise.all(
      EXECUTABLE_ROOTS.map(async (root) =>
        (await collectFiles(path.join(cwd, root))).map((file) => path.relative(cwd, file)),
      ),
    )
  ).flat();
  relativeFiles.push("package.json");
  const findings: Array<{ file: string; marker: string }> = [];
  for (const file of relativeFiles) {
    if (file === SELF || file.endsWith("check-ax-data-isolation.test.ts")) continue;
    const body = await readFile(path.join(cwd, file), "utf8");
    for (const marker of BANNED_MARKERS) {
      if (body.includes(marker)) findings.push({ file, marker });
    }
  }
  return findings;
}

async function main() {
  const findings = await findAxDataExecutionDependencies();
  if (findings.length) {
    throw new Error(
      `AX Data execution isolation failed:\n${findings
        .map((finding) => `- ${finding.file}: ${finding.marker}`)
        .join("\n")}`,
    );
  }
  process.stdout.write("AX Data execution isolation passed.\n");
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
