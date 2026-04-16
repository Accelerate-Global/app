import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

const DIRECT_TEST_SOURCE_PATTERNS = [
  "config/**/*.ts",
  "scripts/**/*.ts",
  "src/**/*.ts",
  "src/**/*.tsx",
] as const;
const DIRECT_TEST_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
] as const;
const DIRECT_TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/u;

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

export type TestDeltaMapping = {
  sourcePath: string;
  candidateTestPaths: string[];
  changedTestPaths: string[];
};

export type TestDeltaReport = {
  changedFiles: string[];
  changedTestFiles: string[];
  coveredSourceFiles: string[];
  mappings: TestDeltaMapping[];
  missingTestUpdates: TestDeltaMapping[];
  exitCode: 0 | 1;
};

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function matchesAnyPattern(filePath: string, patterns: readonly string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

export function isDirectTestFile(filePath: string) {
  return DIRECT_TEST_FILE_PATTERN.test(normalizePath(filePath));
}

export function isDirectlyTestableSourceFile(filePath: string) {
  const normalizedPath = normalizePath(filePath);

  if (isDirectTestFile(normalizedPath)) {
    return false;
  }

  return matchesAnyPattern(normalizedPath, DIRECT_TEST_SOURCE_PATTERNS);
}

export function getDirectTestCandidatePaths(filePath: string) {
  const normalizedPath = normalizePath(filePath);
  const sourceStem = normalizedPath.replace(/\.(ts|tsx)$/u, "");

  if (sourceStem === normalizedPath) {
    return [];
  }

  return DIRECT_TEST_SUFFIXES.map((suffix) => `${sourceStem}${suffix}`);
}

async function filterExistingPaths(rootDir: string, filePaths: string[]) {
  const checks = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await access(path.join(rootDir, filePath), constants.F_OK);
        return filePath;
      } catch {
        return null;
      }
    }),
  );

  return checks.filter((filePath): filePath is string => Boolean(filePath));
}

export async function evaluateTestImpact(input: {
  changedFiles: string[];
  rootDir: string;
}): Promise<TestDeltaReport> {
  const changedFiles = [...new Set(input.changedFiles.map(normalizePath))].sort();
  const changedFileSet = new Set(changedFiles);
  const changedTestFiles = changedFiles.filter(isDirectTestFile);
  const coveredMappings: TestDeltaMapping[] = [];

  for (const changedFile of changedFiles) {
    if (!isDirectlyTestableSourceFile(changedFile)) {
      continue;
    }

    const candidateTestPaths = await filterExistingPaths(
      input.rootDir,
      getDirectTestCandidatePaths(changedFile),
    );

    if (candidateTestPaths.length === 0) {
      continue;
    }

    coveredMappings.push({
      sourcePath: changedFile,
      candidateTestPaths,
      changedTestPaths: candidateTestPaths.filter((testPath) =>
        changedFileSet.has(testPath),
      ),
    });
  }

  const missingTestUpdates = coveredMappings.filter(
    (mapping) => mapping.changedTestPaths.length === 0,
  );

  return {
    changedFiles,
    changedTestFiles,
    coveredSourceFiles: coveredMappings.map((mapping) => mapping.sourcePath),
    mappings: coveredMappings,
    missingTestUpdates,
    exitCode: missingTestUpdates.length > 0 ? 1 : 0,
  };
}

export function formatTestDeltaMapping(mapping: TestDeltaMapping) {
  return `${mapping.sourcePath} -> ${mapping.candidateTestPaths.join(", ")}`;
}

export function formatMissingTestUpdate(mapping: TestDeltaMapping) {
  return `${mapping.sourcePath} -> update at least one of ${mapping.candidateTestPaths.join(", ")}`;
}
