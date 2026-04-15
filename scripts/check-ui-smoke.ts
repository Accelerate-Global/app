import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { smokeRouteSpecs } from "../tests/ui/route-registry";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src/app");
const SRC_DIR = path.join(ROOT, "src");
const UI_COMPONENTS_DIR = path.join(ROOT, "src/components/ui");
const GENERATED_FIXTURE_MANIFEST = path.join(
  UI_COMPONENTS_DIR,
  "smoke-fixtures.generated.ts",
);

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

async function walkFiles(directoryPath: string): Promise<string[]> {
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

async function main() {
  const appFiles = await walkFiles(APP_DIR);
  const pageFiles = appFiles
    .filter((filePath) => filePath.endsWith("/page.tsx"))
    .map((filePath) => normalizePath(path.relative(ROOT, filePath)))
    .sort();
  const registryPageFiles = [...new Set(smokeRouteSpecs.map((route) => route.pageFile))].sort();
  const missingRouteEntries = pageFiles.filter(
    (pageFile) => !registryPageFiles.includes(pageFile),
  );
  const staleRouteEntries = registryPageFiles.filter(
    (pageFile) => !pageFiles.includes(pageFile),
  );
  const duplicateRouteIds = smokeRouteSpecs
    .map((route) => route.id)
    .filter((routeId, index, ids) => ids.indexOf(routeId) !== index);

  const uiComponentFiles = (await walkFiles(UI_COMPONENTS_DIR))
    .filter((filePath) => filePath.endsWith(".tsx"))
    .filter((filePath) => !filePath.endsWith(".smoke.tsx"))
    .filter((filePath) => !filePath.endsWith(".test.tsx"))
    .filter((filePath) => !filePath.endsWith(".spec.tsx"))
    .filter((filePath) => !filePath.endsWith("smoke-fixtures.generated.ts"))
    .sort();
  const uiFixtureFiles = (await walkFiles(UI_COMPONENTS_DIR))
    .filter((filePath) => filePath.endsWith(".smoke.tsx"))
    .sort();
  const componentBaseNames = uiComponentFiles.map((filePath) =>
    path.basename(filePath, ".tsx"),
  );
  const missingFixtures = componentBaseNames.filter((componentBaseName) => {
    const fixturePath = path.join(UI_COMPONENTS_DIR, `${componentBaseName}.smoke.tsx`);
    return !uiFixtureFiles.includes(fixturePath);
  });

  const manifestComponentBaseNames = [...componentBaseNames].sort((left, right) =>
    left.localeCompare(right),
  );
  const fixtureManifest = createFixtureManifestContent(manifestComponentBaseNames);

  await mkdir(path.dirname(GENERATED_FIXTURE_MANIFEST), { recursive: true });
  await writeFile(GENERATED_FIXTURE_MANIFEST, fixtureManifest, "utf8");

  const srcFiles = (await walkFiles(SRC_DIR))
    .filter((filePath) => filePath.endsWith(".tsx"))
    .filter((filePath) => !filePath.endsWith("smoke-fixtures.generated.ts"));
  const attributeState = {
    pageIds: new Set<string>(),
    triggerIds: new Set<string>(),
    surfaceIds: new Set<string>(),
    readyIds: new Set<string>(),
    closeIds: new Set<string>(),
  };

  for (const filePath of srcFiles) {
    const content = await readFile(filePath, "utf8");

    for (const pageId of collectLiteralAttributeValues(content, "data-smoke-page")) {
      attributeState.pageIds.add(pageId);
    }
    for (const triggerId of collectLiteralAttributeValues(content, "data-smoke-trigger")) {
      attributeState.triggerIds.add(triggerId);
    }
    for (const surfaceId of collectLiteralAttributeValues(content, "data-smoke-surface")) {
      attributeState.surfaceIds.add(surfaceId);
    }
    for (const readyId of collectLiteralAttributeValues(content, "data-smoke-ready")) {
      attributeState.readyIds.add(readyId);
    }
    for (const closeId of collectLiteralAttributeValues(content, "data-smoke-close")) {
      attributeState.closeIds.add(closeId);
    }
  }

  const missingPageMarkers = smokeRouteSpecs
    .filter((route) => route.pageId)
    .filter((route) => !attributeState.pageIds.has(route.pageId!))
    .map((route) => route.pageId!);
  const triggerWithoutSurface = [...attributeState.triggerIds].filter(
    (triggerId) => !attributeState.surfaceIds.has(triggerId),
  );
  const surfaceWithoutTrigger = [...attributeState.surfaceIds].filter(
    (surfaceId) => !attributeState.triggerIds.has(surfaceId),
  );
  const surfaceWithoutReady = [...attributeState.surfaceIds].filter(
    (surfaceId) => !attributeState.readyIds.has(surfaceId),
  );
  const readyWithoutSurface = [...attributeState.readyIds].filter(
    (readyId) => !attributeState.surfaceIds.has(readyId),
  );
  const closeWithoutSurface = [...attributeState.closeIds].filter(
    (closeId) => !attributeState.surfaceIds.has(closeId),
  );

  const errors = [
    ...missingRouteEntries.map(
      (pageFile) => `Missing smoke route entry for ${pageFile}`,
    ),
    ...staleRouteEntries.map(
      (pageFile) => `Smoke route registry points at missing page ${pageFile}`,
    ),
    ...duplicateRouteIds.map((routeId) => `Duplicate smoke route id ${routeId}`),
    ...missingFixtures.map(
      (componentBaseName) =>
        `Missing shared UI smoke fixture src/components/ui/${componentBaseName}.smoke.tsx`,
    ),
    ...missingPageMarkers.map(
      (pageId) => `Missing data-smoke-page marker for ${pageId}`,
    ),
    ...triggerWithoutSurface.map(
      (triggerId) => `Smoke trigger ${triggerId} is missing a matching data-smoke-surface`,
    ),
    ...surfaceWithoutTrigger.map(
      (surfaceId) => `Smoke surface ${surfaceId} is missing a matching data-smoke-trigger`,
    ),
    ...surfaceWithoutReady.map(
      (surfaceId) => `Smoke surface ${surfaceId} is missing a matching data-smoke-ready`,
    ),
    ...readyWithoutSurface.map(
      (readyId) => `Smoke ready marker ${readyId} is missing a matching data-smoke-surface`,
    ),
    ...closeWithoutSurface.map(
      (closeId) => `Smoke close marker ${closeId} is missing a matching data-smoke-surface`,
    ),
  ];

  if (errors.length > 0) {
    throw new Error(
      ["UI smoke contract check failed:", ...errors.map((error) => `- ${error}`)].join(
        "\n",
      ),
    );
  }

  console.log(
    `UI smoke contract OK: ${pageFiles.length} pages, ${componentBaseNames.length} shared components.`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
