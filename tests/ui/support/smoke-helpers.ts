import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import type { SmokeRouteSpec } from "../types";
import { readUiSmokeBootstrap, resolveUiSmokeTemplate } from "./bootstrap";

export type SmokeFailureClass =
  | "contract"
  | "selector"
  | "harness"
  | "bootstrap"
  | "product";

function isClassifiedSmokeError(message: string) {
  return /^\[(contract|selector|harness|bootstrap|product)\]/u.test(message);
}

function classifySmokeError(input: {
  classification: SmokeFailureClass;
  context: string;
  error: unknown;
}) {
  if (input.error instanceof Error && isClassifiedSmokeError(input.error.message)) {
    return input.error;
  }

  const detail =
    input.error instanceof Error ? input.error.message : String(input.error);
  const classification = detail.includes("strict mode violation")
    ? "selector"
    : input.classification;

  return new Error(`[${classification}] ${input.context}: ${detail}`);
}

async function runSmokeStep<T>(input: {
  classification: SmokeFailureClass;
  context: string;
  action: () => Promise<T>;
}) {
  try {
    return await input.action();
  } catch (error) {
    throw classifySmokeError({
      classification: input.classification,
      context: input.context,
      error,
    });
  }
}

async function findFirstVisible(locator: Locator) {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);

    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

export async function assertSmokeRoute(page: Page, route: SmokeRouteSpec) {
  const bootstrap = await readUiSmokeBootstrap();
  const targetPath = resolveUiSmokeTemplate(route.path, bootstrap);

  await runSmokeStep({
    classification: "product",
    context: `Smoke route ${route.id} navigation`,
    action: () => page.goto(targetPath),
  });

  if (route.redirectTo) {
    const expectedRedirect = resolveUiSmokeTemplate(route.redirectTo, bootstrap);

    await runSmokeStep({
      classification: "product",
      context: `Smoke route ${route.id} redirect`,
      action: () =>
        page.waitForURL(
          (url) => `${url.pathname}${url.search}` === expectedRedirect,
          { timeout: 15_000 },
        ),
    });
    await runSmokeStep({
      classification: "product",
      context: `Smoke route ${route.id} redirect target`,
      action: async () => {
        expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
          expectedRedirect,
        );
      },
    });
    return;
  }

  if (!route.pageId) {
    throw new Error(`[contract] Smoke route ${route.id} is missing pageId.`);
  }

  const pageMarker = page.locator(`[data-smoke-page="${route.pageId}"]`);
  const pageReadyMarker = page.locator(
    `[data-smoke-page-ready="${route.pageId}"]`,
  );

  await runSmokeStep({
    classification: "contract",
    context: `Smoke route ${route.id} page marker`,
    action: () => expect(pageMarker).toBeVisible(),
  });
  await runSmokeStep({
    classification: "contract",
    context: `Smoke route ${route.id} ready marker`,
    action: () => expect(pageReadyMarker).toBeVisible(),
  });

  if (route.assertFixtureCoverage) {
    const fixtures = page.locator("[data-ui-smoke-fixture]");
    const fixtureCount = await fixtures.count();

    await runSmokeStep({
      classification: "contract",
      context: `Smoke fixture coverage on ${route.id}`,
      action: async () => {
        expect(fixtureCount).toBeGreaterThan(0);
      },
    });

    for (let index = 0; index < fixtureCount; index += 1) {
      await fixtures.nth(index).scrollIntoViewIfNeeded();
      await runSmokeStep({
        classification: "product",
        context: `Smoke fixture ${index + 1} visibility on ${route.id}`,
        action: () => expect(fixtures.nth(index)).toBeVisible(),
      });
    }

    return;
  }

  await crawlSmokeSurfaces(page);
}

export async function crawlSmokeSurfaces(page: Page) {
  const triggers = page.locator("[data-smoke-trigger]");
  const triggerCount = await triggers.count();
  const triggerIds = new Set<string>();

  for (let index = 0; index < triggerCount; index += 1) {
    const candidate = triggers.nth(index);
    const triggerId = await candidate.getAttribute("data-smoke-trigger");

    if (!triggerId || triggerIds.has(triggerId)) {
      continue;
    }

    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    const writeMode = await candidate.getAttribute("data-smoke-write");

    if (writeMode && writeMode !== "safe") {
      continue;
    }

    triggerIds.add(triggerId);
  }

  for (const triggerId of triggerIds) {
    await exerciseSmokeSurface(page, triggerId);
  }
}

async function exerciseSmokeSurface(page: Page, triggerId: string) {
  const trigger = await findFirstVisible(
    page.locator(`[data-smoke-trigger="${triggerId}"]`),
  );

  if (!trigger) {
    return;
  }

  const surface = page.locator(`[data-smoke-surface="${triggerId}"]`);
  const readyMarker = page.locator(`[data-smoke-ready="${triggerId}"]`);
  const closeControl = page.locator(`[data-smoke-close="${triggerId}"]`);

  await trigger.scrollIntoViewIfNeeded();

  try {
    await trigger.click({ timeout: 5_000 });
    await expect(surface).toBeVisible({ timeout: 1_500 });
  } catch {
    await page.keyboard.press("Escape").catch(() => undefined);

    try {
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(surface).toBeVisible({ timeout: 1_500 });
    } catch {
      await page.keyboard.press("Escape").catch(() => undefined);
      try {
        await trigger.hover({ timeout: 5_000 });
        await expect(surface).toBeVisible({ timeout: 3_000 });
      } catch (error) {
        throw classifySmokeError({
          classification: "harness",
          context: `Smoke surface ${triggerId} could not be opened via click, Enter, or hover`,
          error,
        });
      }
    }
  }

  await runSmokeStep({
    classification: "harness",
    context: `Smoke surface ${triggerId} ready marker`,
    action: () => expect(readyMarker).toBeVisible(),
  });

  const closeButton = await findFirstVisible(closeControl);

  if (closeButton) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }

  await runSmokeStep({
    classification: "harness",
    context: `Smoke surface ${triggerId} close`,
    action: () => expect(surface).toBeHidden({ timeout: 3_000 }),
  });
}

export function getDatasetReplacementFixturePath() {
  return path.join(
    process.cwd(),
    "tests/ui/fixtures/datasets/smoke-dataset-replacement.csv",
  );
}

export async function runSmokeJourney<T>(
  title: string,
  action: () => Promise<T>,
) {
  return runSmokeStep({
    classification: "product",
    context: title,
    action,
  });
}

export function getDatasetRowLocator(page: Page, datasetId: string) {
  return page.locator(`[data-smoke-dataset-row="${datasetId}"]`);
}

export function getDatasetNameLocator(page: Page, datasetId: string) {
  return page.locator(`[data-smoke-dataset-name="${datasetId}"]`);
}

export function getFieldDefinitionRowLocator(page: Page, fieldDefinitionId: string) {
  return page.locator(
    `[data-smoke-field-definition-row="${fieldDefinitionId}"]:visible`,
  );
}

export function getFieldDefinitionNameLocator(page: Page, fieldDefinitionId: string) {
  return page.locator(
    `[data-smoke-field-definition-name="${fieldDefinitionId}"]:visible`,
  );
}

export function getFieldSourceColumnLocator(page: Page, label: string) {
  return page.locator(`[data-smoke-field-source-column="${label}"]`);
}
