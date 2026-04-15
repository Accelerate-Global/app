import { expect, test } from "@playwright/test";

import { readUiSmokeBootstrap } from "./support/bootstrap";
import { getSmokeProjectContext } from "./support/project-context";
import { getDatasetReplacementFixturePath } from "./support/smoke-helpers";

test.describe.configure({ mode: "serial" });

function skipUnlessDesktopAdmin(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "admin" || project.viewport !== "desktop";
}

test("admin can edit dataset details", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  const bootstrap = await readUiSmokeBootstrap();
  const originalDatasetName = bootstrap.datasets.primary.fileName;
  const nextDatasetName = "Smoke Primary Dataset Updated";

  await page.goto("/dashboard");
  await page
    .locator(
      `[data-smoke-dataset-id="${bootstrap.datasets.primary.id}"][data-smoke-trigger="dataset-edit-sheet"]`,
    )
    .click();
  await expect(page.locator('[data-smoke-ready="dataset-edit-sheet"]')).toBeVisible();
  await page.getByLabel("Dataset name").fill(nextDatasetName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator('[data-smoke-surface="dataset-edit-sheet"]'),
  ).toBeHidden();
  await expect(page.getByText(nextDatasetName)).toBeVisible();

  await page
    .locator(
      `[data-smoke-dataset-id="${bootstrap.datasets.primary.id}"][data-smoke-trigger="dataset-edit-sheet"]`,
    )
    .click();
  await page.getByLabel("Dataset name").fill(originalDatasetName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(originalDatasetName)).toBeVisible();
});

test("admin can edit a field definition", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  const bootstrap = await readUiSmokeBootstrap();
  const originalDisplayLabel = "People ID";
  const originalDefinition = "Unique people group identifier used across the workspace.";
  const nextDefinition = "Smoke test definition updated from Playwright.";
  const nextDisplayLabel = "Smoke People ID";

  await page.goto("/dashboard/field-definitions");
  await page
    .locator(
      `[data-smoke-field-definition-id="${bootstrap.fieldDefinitions.editable.id}"][data-smoke-trigger="field-definition-edit-sheet"]`,
    )
    .first()
    .click();
  await expect(
    page.locator('[data-smoke-ready="field-definition-edit-sheet"]'),
  ).toBeVisible();
  await page.getByLabel("Display label").fill(nextDisplayLabel);
  await page.getByLabel("Definition").fill(nextDefinition);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.locator('[data-smoke-surface="field-definition-edit-sheet"]'),
  ).toBeHidden();
  await expect(page.getByText(nextDisplayLabel)).toBeVisible();

  await page
    .locator(
      `[data-smoke-field-definition-id="${bootstrap.fieldDefinitions.editable.id}"][data-smoke-trigger="field-definition-edit-sheet"]`,
    )
    .first()
    .click();
  await page.getByLabel("Display label").fill(originalDisplayLabel);
  await page.getByLabel("Definition").fill(originalDefinition);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(originalDisplayLabel)).toBeVisible();
});

test("admin can create and update filter settings", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await page.goto("/dashboard/filter-settings");
  await page.locator('[data-smoke-region-create-name]').fill("Smoke Region");
  await page
    .locator('[data-smoke-region-country-search="create"]')
    .fill("Nepal");
  await page.getByLabel("Include Nepal").click();
  await page.locator('[data-smoke-region-create-submit]').click();
  await expect(page.getByText("Created Smoke Region.")).toBeVisible();

  const smokeRegionCard = page.locator('[data-smoke-region-card="Smoke Region"]');
  await expect(smokeRegionCard).toBeVisible();
  await smokeRegionCard
    .locator('[data-smoke-region-description]')
    .fill("Smoke region updated by the UI smoke suite.");
  await smokeRegionCard.locator('[data-smoke-region-save]').click();
  await expect(
    smokeRegionCard.locator('[data-smoke-region-description]'),
  ).toHaveValue("Smoke region updated by the UI smoke suite.");
});

test("admin can create a source column and update a field source value", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  const bootstrap = await readUiSmokeBootstrap();

  await page.goto("/dashboard/field-sources");
  await page.locator('[data-smoke-field-source-add-input]').fill("Smoke Source");
  await page.locator('[data-smoke-field-source-add-submit]').click();
  await expect(page.getByText("Smoke Source")).toBeVisible();

  const fieldSourceInput = page.locator(
    `[data-smoke-field-source-input="${bootstrap.fieldDefinitions.editable.id}:${bootstrap.fieldSourceTypes.editable.id}"]`,
  );
  await fieldSourceInput.fill("SMOKE_SOURCE_FIELD");
  await fieldSourceInput.blur();
  await expect(fieldSourceInput).toHaveValue("SMOKE_SOURCE_FIELD");
});

test("admin can replace a dataset through the real upload flow", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  const bootstrap = await readUiSmokeBootstrap();

  await page.goto(`/dashboard/upload?replace=${bootstrap.datasets.secondary.id}`);
  await page
    .locator('[data-smoke-upload-input="dataset-upload"]')
    .setInputFiles(getDatasetReplacementFixturePath());
  await expect(page.getByText("Replacement complete")).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByText("smoke-dataset-replacement.csv is ready."),
  ).toBeVisible();
});
