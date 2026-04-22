import { defineConfig } from "@playwright/test";

import {
  UI_SMOKE_BASE_URL,
  UI_SMOKE_STORAGE_STATES,
} from "./tests/ui/support/smoke-data";

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  // Keep CI strict, but allow one local retry for transient repo-local
  // Supabase/auth hiccups during the long smoke sweep.
  retries: process.env.CI ? 0 : 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/ui-smoke" }],
  ],
  outputDir: "test-results/ui-smoke",
  use: {
    baseURL: UI_SMOKE_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  globalSetup: "./tests/ui/global.setup.ts",
  webServer: {
    command: "pnpm exec next start --port 3100",
    env: {
      ...process.env,
      UI_SMOKE_ENABLED: process.env.UI_SMOKE_ENABLED ?? "1",
    },
    url: UI_SMOKE_BASE_URL,
    // Local verification runs `pnpm build` before Playwright. Reusing an
    // already-running `next start` can leave the smoke browser on stale assets,
    // which breaks hydration and turns form submits into plain GET navigations.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-anonymous",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.anonymous,
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "desktop-viewer",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.viewer,
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "desktop-admin",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.admin,
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "mobile-anonymous",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.anonymous,
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-viewer",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.viewer,
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-admin",
      use: {
        storageState: UI_SMOKE_STORAGE_STATES.admin,
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
