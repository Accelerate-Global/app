import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const generatedArchivePurposePattern = /TBD - created by archiving change/u;

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

function normalizePath(rootDir: string, filePath: string) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

async function collectMarkdownFiles(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
    }),
  );

  return files.flat();
}

export async function listActiveOpenSpecChanges(rootDir = process.cwd()) {
  const changesDir = path.join(rootDir, "openspec", "changes");

  if (!(await pathExists(changesDir))) {
    return [];
  }

  const entries = await readdir(changesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "archive" && !name.startsWith("."))
    .sort();
}

export async function listGeneratedOpenSpecPurposePlaceholders(
  rootDir = process.cwd(),
) {
  const specsDir = path.join(rootDir, "openspec", "specs");
  const markdownFiles = await collectMarkdownFiles(specsDir);
  const matches = await Promise.all(
    markdownFiles.map(async (filePath) => {
      const content = await readFile(filePath, "utf8");

      return generatedArchivePurposePattern.test(content)
        ? normalizePath(rootDir, filePath)
        : null;
    }),
  );

  return matches.filter((filePath): filePath is string => Boolean(filePath)).sort();
}

export async function checkOpenSpecArchiveReadiness(rootDir = process.cwd()) {
  const [activeChanges, placeholderSpecs] = await Promise.all([
    listActiveOpenSpecChanges(rootDir),
    listGeneratedOpenSpecPurposePlaceholders(rootDir),
  ]);
  const issues: string[] = [];

  if (activeChanges.length > 0) {
    issues.push(
      [
        "Active OpenSpec changes must be archived before ship:",
        ...activeChanges.map((change) => `- ${change}`),
      ].join("\n"),
    );
  }

  if (placeholderSpecs.length > 0) {
    issues.push(
      [
        "Archived OpenSpec specs must replace generated Purpose placeholders:",
        ...placeholderSpecs.map((filePath) => `- ${filePath}`),
      ].join("\n"),
    );
  }

  return {
    activeChanges,
    placeholderSpecs,
    issues,
  };
}

export async function assertOpenSpecArchiveReady(rootDir = process.cwd()) {
  const result = await checkOpenSpecArchiveReadiness(rootDir);

  if (result.issues.length > 0) {
    throw new Error(result.issues.join("\n\n"));
  }

  return result;
}
