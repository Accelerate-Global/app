import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ContractRequirementId } from "../../config/change-impact";
import { smokeRouteSpecs } from "../../tests/ui/route-registry";
import type { SmokeRouteSpec } from "../../tests/ui/types";

const APP_DIR = "src/app";
const SRC_DIR = "src";
const UI_COMPONENTS_DIR = "src/components/ui";
const GENERATED_FIXTURE_MANIFEST = "src/components/ui/smoke-fixtures.generated.ts";

export type UiSmokeContractIssue = {
  requirement: ContractRequirementId;
  message: string;
};

export type UiSmokeFileAttributeState = {
  pageIds: string[];
  pageReadyIds: string[];
  triggerIds: string[];
  surfaceIds: string[];
  readyIds: string[];
  closeIds: string[];
};

type UiSmokeRouteContractSpec = Pick<
  SmokeRouteSpec,
  "id" | "pageFile" | "pageId" | "redirectTo"
>;

export type UiSmokeContractEvaluationInput = {
  pageFiles: string[];
  routeSpecs: UiSmokeRouteContractSpec[];
  uiComponentFiles: string[];
  uiFixtureFiles: string[];
  fileAttributeState: Record<string, UiSmokeFileAttributeState>;
};

export type UiSmokeContractReport = {
  pageFiles: string[];
  componentBaseNames: string[];
  fixtureManifest: string;
  issues: UiSmokeContractIssue[];
};

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

async function walkFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          return walkFiles(entryPath);
        }

        return [entryPath];
      }),
    );

    return files.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function toImportIdentifier(fileName: string) {
  return `${fileName}`
    .replace(/\.smoke$/u, "")
    .replace(/(^|[-_])([a-z0-9])/gu, (_, __, character: string) =>
      character.toUpperCase(),
    )
    .replace(/[^A-Za-z0-9]/gu, "");
}

function collectLiteralAttributeValues(
  source: string,
  attributeName: string,
): string[] {
  const pattern = new RegExp(`${attributeName}\\s*=\\s*"([^"]+)"`, "g");
  const values = new Set<string>();

  for (const match of source.matchAll(pattern)) {
    const value = match[1]?.trim();

    if (value) {
      values.add(value);
    }
  }

  return [...values];
}

function createFixtureManifestContent(componentBaseNames: string[]) {
  const imports = componentBaseNames.map((componentBaseName) => {
    const importIdentifier = `${toImportIdentifier(componentBaseName)}Fixture`;
    return `import ${importIdentifier} from "@/components/ui/${componentBaseName}.smoke";`;
  });
  const fixtures = componentBaseNames.map(
    (componentBaseName) => `${toImportIdentifier(componentBaseName)}Fixture`,
  );

  return `${imports.join("\n")}

export const uiSmokeFixtures = [${fixtures.join(", ")}] as const;
`;
}

function toAttributeSets(attributeState: UiSmokeFileAttributeState | undefined) {
  return {
    pageIds: new Set(attributeState?.pageIds ?? []),
    pageReadyIds: new Set(attributeState?.pageReadyIds ?? []),
    triggerIds: new Set(attributeState?.triggerIds ?? []),
    surfaceIds: new Set(attributeState?.surfaceIds ?? []),
    readyIds: new Set(attributeState?.readyIds ?? []),
    closeIds: new Set(attributeState?.closeIds ?? []),
  };
}

export function evaluateUiSmokeContracts(
  input: UiSmokeContractEvaluationInput,
): UiSmokeContractReport {
  const registryPageFiles = [...new Set(input.routeSpecs.map((route) => route.pageFile))].sort();
  const missingRouteEntries = input.pageFiles.filter(
    (pageFile) => !registryPageFiles.includes(pageFile),
  );
  const staleRouteEntries = registryPageFiles.filter(
    (pageFile) => !input.pageFiles.includes(pageFile),
  );
  const duplicateRouteIds = input.routeSpecs
    .map((route) => route.id)
    .filter((routeId, index, routeIds) => routeIds.indexOf(routeId) !== index);

  const componentBaseNames = input.uiComponentFiles
    .map((filePath) => path.basename(filePath, ".tsx"))
    .sort((left, right) => left.localeCompare(right));
  const fixtureBaseNames = new Set(
    input.uiFixtureFiles.map((filePath) => path.basename(filePath, ".smoke.tsx")),
  );
  const missingFixtures = componentBaseNames.filter(
    (componentBaseName) => !fixtureBaseNames.has(componentBaseName),
  );

  const fileAttributeEntries = Object.entries(input.fileAttributeState);
  const allTriggerIds = new Set<string>();
  const allSurfaceIds = new Set<string>();
  const allReadyIds = new Set<string>();
  const allCloseIds = new Set<string>();

  for (const [, attributeState] of fileAttributeEntries) {
    for (const triggerId of attributeState.triggerIds) {
      allTriggerIds.add(triggerId);
    }
    for (const surfaceId of attributeState.surfaceIds) {
      allSurfaceIds.add(surfaceId);
    }
    for (const readyId of attributeState.readyIds) {
      allReadyIds.add(readyId);
    }
    for (const closeId of attributeState.closeIds) {
      allCloseIds.add(closeId);
    }
  }

  const issues: UiSmokeContractIssue[] = [
    ...missingRouteEntries.map((pageFile) => ({
      requirement: "route-registry-entry" as const,
      message: `Missing smoke route entry for ${pageFile}`,
    })),
    ...staleRouteEntries.map((pageFile) => ({
      requirement: "route-registry-entry" as const,
      message: `Smoke route registry points at missing page ${pageFile}`,
    })),
    ...duplicateRouteIds.map((routeId) => ({
      requirement: "route-registry-entry" as const,
      message: `Duplicate smoke route id ${routeId}`,
    })),
    ...missingFixtures.map((componentBaseName) => ({
      requirement: "shared-ui-fixture" as const,
      message: `Missing shared UI smoke fixture src/components/ui/${componentBaseName}.smoke.tsx`,
    })),
  ];

  for (const route of input.routeSpecs) {
    if (!route.redirectTo && !route.pageId) {
      issues.push({
        requirement: "route-registry-entry",
        message: `Smoke route ${route.id} must declare pageId or redirectTo`,
      });
      continue;
    }

    if (!route.pageId) {
      continue;
    }

    const fileAttributes = toAttributeSets(input.fileAttributeState[route.pageFile]);

    if (!fileAttributes.pageIds.has(route.pageId)) {
      issues.push({
        requirement: "page-marker",
        message: `Missing data-smoke-page="${route.pageId}" marker in ${route.pageFile}`,
      });
    }

    if (!fileAttributes.pageReadyIds.has(route.pageId)) {
      issues.push({
        requirement: "page-ready-marker",
        message: `Missing data-smoke-page-ready="${route.pageId}" marker in ${route.pageFile}`,
      });
    }
  }

  const triggerWithoutSurface = [...allTriggerIds].filter(
    (triggerId) => !allSurfaceIds.has(triggerId),
  );
  const surfaceWithoutTrigger = [...allSurfaceIds].filter(
    (surfaceId) => !allTriggerIds.has(surfaceId),
  );
  const surfaceWithoutReady = [...allSurfaceIds].filter(
    (surfaceId) => !allReadyIds.has(surfaceId),
  );
  const readyWithoutSurface = [...allReadyIds].filter(
    (readyId) => !allSurfaceIds.has(readyId),
  );
  const closeWithoutSurface = [...allCloseIds].filter(
    (closeId) => !allSurfaceIds.has(closeId),
  );

  issues.push(
    ...triggerWithoutSurface.map((triggerId) => ({
      requirement: "smoke-surface-literals" as const,
      message: `Smoke trigger ${triggerId} is missing a matching data-smoke-surface`,
    })),
    ...surfaceWithoutTrigger.map((surfaceId) => ({
      requirement: "smoke-surface-literals" as const,
      message: `Smoke surface ${surfaceId} is missing a matching data-smoke-trigger`,
    })),
    ...surfaceWithoutReady.map((surfaceId) => ({
      requirement: "smoke-surface-literals" as const,
      message: `Smoke surface ${surfaceId} is missing a matching data-smoke-ready`,
    })),
    ...readyWithoutSurface.map((readyId) => ({
      requirement: "smoke-surface-literals" as const,
      message: `Smoke ready marker ${readyId} is missing a matching data-smoke-surface`,
    })),
    ...closeWithoutSurface.map((closeId) => ({
      requirement: "smoke-surface-literals" as const,
      message: `Smoke close marker ${closeId} is missing a matching data-smoke-surface`,
    })),
  );

  return {
    pageFiles: [...input.pageFiles].sort(),
    componentBaseNames,
    fixtureManifest: createFixtureManifestContent(componentBaseNames),
    issues,
  };
}

export async function analyzeUiSmokeContracts(input: {
  rootDir: string;
  writeFixtureManifest?: boolean;
}) {
  const appFiles = await walkFiles(path.join(input.rootDir, APP_DIR));
  const pageFiles = appFiles
    .filter((filePath) => filePath.endsWith("/page.tsx"))
    .map((filePath) => normalizePath(path.relative(input.rootDir, filePath)))
    .sort();
  const uiComponentFiles = (await walkFiles(path.join(input.rootDir, UI_COMPONENTS_DIR)))
    .filter((filePath) => filePath.endsWith(".tsx"))
    .filter((filePath) => !filePath.endsWith(".smoke.tsx"))
    .filter((filePath) => !filePath.endsWith(".test.tsx"))
    .filter((filePath) => !filePath.endsWith(".spec.tsx"))
    .filter((filePath) => !filePath.endsWith("smoke-fixtures.generated.ts"))
    .map((filePath) => normalizePath(path.relative(input.rootDir, filePath)))
    .sort();
  const uiFixtureFiles = (await walkFiles(path.join(input.rootDir, UI_COMPONENTS_DIR)))
    .filter((filePath) => filePath.endsWith(".smoke.tsx"))
    .map((filePath) => normalizePath(path.relative(input.rootDir, filePath)))
    .sort();
  const srcFiles = (await walkFiles(path.join(input.rootDir, SRC_DIR)))
    .filter((filePath) => filePath.endsWith(".tsx"))
    .filter((filePath) => !filePath.endsWith("smoke-fixtures.generated.ts"));
  const fileAttributeState: Record<string, UiSmokeFileAttributeState> = {};

  for (const filePath of srcFiles) {
    const content = await readFile(filePath, "utf8");
    const relativeFilePath = normalizePath(path.relative(input.rootDir, filePath));

    fileAttributeState[relativeFilePath] = {
      pageIds: collectLiteralAttributeValues(content, "data-smoke-page"),
      pageReadyIds: collectLiteralAttributeValues(content, "data-smoke-page-ready"),
      triggerIds: collectLiteralAttributeValues(content, "data-smoke-trigger"),
      surfaceIds: collectLiteralAttributeValues(content, "data-smoke-surface"),
      readyIds: collectLiteralAttributeValues(content, "data-smoke-ready"),
      closeIds: collectLiteralAttributeValues(content, "data-smoke-close"),
    };
  }

  const report = evaluateUiSmokeContracts({
    pageFiles,
    routeSpecs: smokeRouteSpecs,
    uiComponentFiles,
    uiFixtureFiles,
    fileAttributeState,
  });

  if (input.writeFixtureManifest) {
    const fixtureManifestPath = path.join(input.rootDir, GENERATED_FIXTURE_MANIFEST);
    await mkdir(path.dirname(fixtureManifestPath), { recursive: true });
    await writeFile(fixtureManifestPath, report.fixtureManifest, "utf8");
  }

  return report;
}
