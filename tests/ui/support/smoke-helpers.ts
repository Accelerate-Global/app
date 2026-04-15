import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import type { SmokeRouteSpec } from "../types";
import { readUiSmokeBootstrap, resolveUiSmokeTemplate } from "./bootstrap";

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

  await page.goto(targetPath);

  if (route.redirectTo) {
    const expectedRedirect = resolveUiSmokeTemplate(route.redirectTo, bootstrap);

    await page.waitForURL(
      (url) => `${url.pathname}${url.search}` === expectedRedirect,
      { timeout: 15_000 },
    );
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      expectedRedirect,
    );
    return;
  }

  if (!route.pageId) {
    throw new Error(`Smoke route ${route.id} is missing pageId.`);
  }

  const pageMarker = page.locator(`[data-smoke-page="${route.pageId}"]`);
  const pageReadyMarker = page.locator(
    `[data-smoke-page-ready="${route.pageId}"]`,
  );

  await expect(pageMarker).toBeVisible();
  await expect(pageReadyMarker).toBeVisible();

  if (route.assertFixtureCoverage) {
    const fixtures = page.locator("[data-ui-smoke-fixture]");
    const fixtureCount = await fixtures.count();

    expect(fixtureCount).toBeGreaterThan(0);

    for (let index = 0; index < fixtureCount; index += 1) {
      await fixtures.nth(index).scrollIntoViewIfNeeded();
      await expect(fixtures.nth(index)).toBeVisible();
    }
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
    await trigger.click();
    await expect(surface).toBeVisible({ timeout: 1_500 });
  } catch {
    await trigger.hover();
    await expect(surface).toBeVisible({ timeout: 3_000 });
  }

  await expect(readyMarker).toBeVisible();

  const closeButton = await findFirstVisible(closeControl);

  if (closeButton) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }

  await expect(surface).toBeHidden({ timeout: 3_000 });
}

export function getDatasetReplacementFixturePath() {
  return path.join(
    process.cwd(),
    "tests/ui/fixtures/datasets/smoke-dataset-replacement.csv",
  );
}
