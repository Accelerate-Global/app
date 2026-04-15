import { mkdir } from "node:fs/promises";

import { chromium, expect, type FullConfig } from "@playwright/test";

import {
  UI_SMOKE_AUTH_DIR,
  UI_SMOKE_BASE_URL,
  UI_SMOKE_STORAGE_STATES,
  UI_SMOKE_USERS,
} from "./support/smoke-data";

async function waitForBaseUrl(baseUrl: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the local server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function createSignedInStorageState(input: {
  baseUrl: string;
  email: string;
  password: string;
  storageStatePath: string;
}) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(input.baseUrl);
    await expect(page.locator('[data-smoke-page="home-sign-in"]')).toBeVisible();
    await page.getByLabel("Email").fill(input.email);
    await page.getByLabel("Password").fill(input.password);
    await Promise.all([
      page.waitForURL("**/dashboard"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await page.context().storageState({ path: input.storageStatePath });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseUrl = config.projects[0]?.use.baseURL ?? UI_SMOKE_BASE_URL;

  await mkdir(UI_SMOKE_AUTH_DIR, { recursive: true });
  await waitForBaseUrl(baseUrl);

  const browser = await chromium.launch();
  const anonymousPage = await browser.newPage();
  await anonymousPage.goto(baseUrl);
  await anonymousPage.context().storageState({
    path: UI_SMOKE_STORAGE_STATES.anonymous,
  });
  await browser.close();

  await createSignedInStorageState({
    baseUrl,
    email: UI_SMOKE_USERS.viewer.email,
    password: UI_SMOKE_USERS.viewer.password,
    storageStatePath: UI_SMOKE_STORAGE_STATES.viewer,
  });
  await createSignedInStorageState({
    baseUrl,
    email: UI_SMOKE_USERS.admin.email,
    password: UI_SMOKE_USERS.admin.password,
    storageStatePath: UI_SMOKE_STORAGE_STATES.admin,
  });
}
