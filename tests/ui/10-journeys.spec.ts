import { expect, test, type Page } from "@playwright/test";

import { readUiSmokeBootstrap } from "./support/bootstrap";
import { getSmokeProjectContext } from "./support/project-context";
import { UI_SMOKE_USERS } from "./support/smoke-data";
import {
  getDatasetNameLocator,
  getDatasetReplacementFixturePath,
  getFieldDefinitionNameLocator,
  getFieldSourceColumnLocator,
  runSmokeJourney,
} from "./support/smoke-helpers";

test.describe.configure({ mode: "serial" });

const MAILPIT_BASE_URL =
  process.env.UI_SMOKE_MAILPIT_URL?.trim() || "http://127.0.0.1:54324";

type MailpitMessageSummary = {
  ID: string;
  Created: string;
};

type MailpitSearchResponse = {
  messages: MailpitMessageSummary[];
};

type MailpitMessageDetail = {
  HTML?: string | null;
  Text?: string | null;
};

function skipUnlessDesktopAdmin(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "admin" || project.viewport !== "desktop";
}

function skipUnlessDesktopAnonymous(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "anonymous" || project.viewport !== "desktop";
}

function skipUnlessDesktopPro(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "pro" || project.viewport !== "desktop";
}

function skipUnlessDesktopBasic(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "basic" || project.viewport !== "desktop";
}

async function signInWithPassword(page: Page, input: {
  email: string;
  password: string;
}) {
  await page.goto("/");
  await expect(page.locator('[data-smoke-page="home-sign-in"]')).toBeVisible();
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
}

async function requestPasswordReset(page: Page, email: string) {
  const requestedAt = Date.now();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(
      "If an account exists for that email, a password reset link is on its way.",
    ),
  ).toBeVisible();

  return requestedAt;
}

function extractRecoveryLink(detail: MailpitMessageDetail) {
  const candidates = [detail.Text, detail.HTML].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    const match = candidate.match(
      /https?:\/\/[^\s"'<>)]*\/auth\/(?:v1\/verify|confirm)\?[^\s"'<>)]*/u,
    );

    if (match) {
      return match[0].replaceAll("&amp;", "&");
    }
  }

  return null;
}

async function pollForRecoveryLink(input: {
  email: string;
  requestedAt: number;
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    const searchResponse = await fetch(
      `${MAILPIT_BASE_URL}/api/v1/search?kind=to&query=${encodeURIComponent(input.email)}`,
    );

    if (!searchResponse.ok) {
      throw new Error(
        `Mailpit search failed for ${input.email}: ${searchResponse.status}`,
      );
    }

    const searchPayload = await searchResponse.json() as MailpitSearchResponse;
    const newestMatch = searchPayload.messages
      .filter(
        (message) =>
          Date.parse(message.Created) >= input.requestedAt - 1_000,
      )
      .sort((left, right) => Date.parse(right.Created) - Date.parse(left.Created))[0];

    if (newestMatch) {
      const detailResponse = await fetch(
        `${MAILPIT_BASE_URL}/api/v1/message/${newestMatch.ID}`,
      );

      if (!detailResponse.ok) {
        throw new Error(
          `Mailpit message fetch failed for ${input.email}: ${detailResponse.status}`,
        );
      }

      const detail = await detailResponse.json() as MailpitMessageDetail;
      const actionLink = extractRecoveryLink(detail);

      if (actionLink) {
        return actionLink;
      }
    }

    await pageWait(1_000);
  }

  throw new Error(`Timed out waiting for recovery email for ${input.email}.`);
}

function pageWait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForResetPasswordPath(page: Page) {
  await page.waitForURL((url) => url.pathname === "/reset-password");
}

async function waitForHomePath(page: Page) {
  await page.waitForURL((url) => url.pathname === "/");
}

async function waitForDashboardPath(page: Page) {
  await page.waitForURL((url) => url.pathname === "/dashboard");
}

test("forgot-password request succeeds", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAnonymous(testInfo.project.name));

  await runSmokeJourney("forgot-password request succeeds", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await requestPasswordReset(page, bootstrap.users.forgotPassword.email);
  });
});

test("recovery link lands on reset-password", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAnonymous(testInfo.project.name));

  await runSmokeJourney("recovery link lands on reset-password", async () => {
    const bootstrap = await readUiSmokeBootstrap();
    const requestedAt = await requestPasswordReset(
      page,
      bootstrap.users.recovery.email,
    );
    const actionLink = await pollForRecoveryLink({
      email: bootstrap.users.recovery.email,
      requestedAt,
    });

    await page.goto(actionLink);
    await waitForResetPasswordPath(page);
    await expect(page.locator('[data-smoke-page="reset-password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save new password" }),
    ).toBeVisible();
  });
});

test("password reset completes", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAnonymous(testInfo.project.name));

  await runSmokeJourney("password reset completes", async () => {
    const bootstrap = await readUiSmokeBootstrap();
    const requestedAt = await requestPasswordReset(
      page,
      bootstrap.users.reset.email,
    );
    const actionLink = await pollForRecoveryLink({
      email: bootstrap.users.reset.email,
      requestedAt,
    });

    await page.goto(actionLink);
    await waitForResetPasswordPath(page);
    await page.getByLabel("New password").fill(
      bootstrap.authFlows.passwordReset.nextPassword,
    );
    await page.getByLabel("Confirm password").fill(
      bootstrap.authFlows.passwordReset.nextPassword,
    );
    await page.getByRole("button", { name: "Save new password" }).click();
    await waitForDashboardPath(page);
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
  });
});

test("signed-in user can sign out", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAnonymous(testInfo.project.name));

  await runSmokeJourney("signed-in user can sign out", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await signInWithPassword(page, {
      email: bootstrap.users.signOut.email,
      password: UI_SMOKE_USERS.signOut.password,
    });
    await page.goto("/dashboard");
    await page.locator('[data-smoke-trigger="account-menu"]').click();
    await expect(page.locator('[data-smoke-surface="account-menu"]')).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await waitForHomePath(page);
    await expect(page.locator('[data-smoke-page="home-sign-in"]')).toBeVisible();
  });
});

test("disabled user cannot sign back in", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAnonymous(testInfo.project.name));

  await runSmokeJourney("disabled user cannot sign back in", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await signInWithPassword(page, {
      email: bootstrap.users.disable.email,
      password: "SmokePass123!",
    });
    await page.goto("/dashboard/profile");
    await page.getByRole("button", { name: "Disable account" }).click();
    await waitForHomePath(page);
    await expect(page.locator('[data-smoke-page="home-sign-in"]')).toBeVisible();

    await page.getByLabel("Email").fill(bootstrap.users.disable.email);
    await page.getByLabel("Password").fill("SmokePass123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Authentication error")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test("basic profile is read-only", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopBasic(testInfo.project.name));

  await runSmokeJourney("basic profile is read-only", async () => {
    await page.goto("/dashboard/profile");
    await expect(page.locator('[data-smoke-page="profile"]')).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeDisabled();
    await expect(page.getByLabel("Email address")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save name" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Update email" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Disable account" })).toBeHidden();
  });
});

test("admin can edit dataset details", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney("admin can edit dataset details", async () => {
    const bootstrap = await readUiSmokeBootstrap();
    const originalDatasetName = bootstrap.datasets.primary.fileName;
    const nextDatasetName = "Smoke Primary Dataset Updated";

    await page.goto("/dashboard");
    await page
      .locator(`[data-smoke-dataset-id="${bootstrap.datasets.primary.id}"]`)
      .click();
    await expect(page.locator('[data-smoke-page="dataset-edit"]')).toBeVisible();
    await page.locator("[data-smoke-dataset-name-input]").fill(nextDatasetName);
    await page.locator("[data-smoke-dataset-save]").click();
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await expect(
      getDatasetNameLocator(page, bootstrap.datasets.primary.id),
    ).toHaveText(nextDatasetName);

    await page
      .locator(`[data-smoke-dataset-id="${bootstrap.datasets.primary.id}"]`)
      .click();
    await expect(page.locator('[data-smoke-page="dataset-edit"]')).toBeVisible();
    await page.locator("[data-smoke-dataset-name-input]").fill(originalDatasetName);
    await page.locator("[data-smoke-dataset-save]").click();
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await expect(
      getDatasetNameLocator(page, bootstrap.datasets.primary.id),
    ).toHaveText(originalDatasetName);

    const secondaryRow = page.locator(
      `[data-smoke-dataset-row="${bootstrap.datasets.secondary.id}"]`,
    );
    await secondaryRow.getByRole("link", { name: "Edit" }).click();
    await expect(page.locator('[data-smoke-page="dataset-edit"]')).toBeVisible();
    await page.locator("[data-smoke-dataset-workspace-visible-toggle]").click();
    await expect(page.locator("[data-smoke-dataset-private-tag]")).toContainText(
      "Private",
    );
    await page.locator("[data-smoke-dataset-save]").click();
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await expect(
      page
        .locator(`[data-smoke-dataset-row="${bootstrap.datasets.secondary.id}"]`)
        .getByText("Private", { exact: true }),
    ).toBeVisible();

    await page
      .locator(`[data-smoke-dataset-row="${bootstrap.datasets.secondary.id}"]`)
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(page.locator('[data-smoke-page="dataset-edit"]')).toBeVisible();
    await page.locator("[data-smoke-dataset-workspace-visible-toggle]").click();
    await expect(page.locator("[data-smoke-dataset-private-tag]")).toHaveCount(0);
    await page.locator("[data-smoke-dataset-save]").click();
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await expect(
      page
        .locator(`[data-smoke-dataset-row="${bootstrap.datasets.secondary.id}"]`)
        .getByText("Private", { exact: true }),
    ).toHaveCount(0);
  });
});

test(
  "admin can onboard a private Google Sheets dataset",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can onboard a private Google Sheets dataset",
      async () => {
        await page.route(
          "**/api/admin/api-connections/google-sheets/check-access",
          async (route) => {
            await route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                preview: {
                  spreadsheetId: "smoke_sheet",
                  spreadsheetUrl:
                    "https://docs.google.com/spreadsheets/d/smoke_sheet/edit",
                  spreadsheetTitle: "Smoke Sheet",
                  sheets: [{ sheetId: 1, title: "People", index: 0 }],
                },
                serviceAccountEmail:
                  "smoke@app-project.iam.gserviceaccount.com",
              }),
            });
          },
        );
        await page.route(
          "**/api/admin/api-connections/google-sheets/header-preview",
          async (route) => {
            await route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                preview: {
                  sheetId: 1,
                  sheetTitle: "People",
                  inspectedRowCount: 2,
                  candidates: [
                    {
                      rowNumber: 1,
                      score: 8,
                      confidence: "high",
                      values: ["People Group", "Country"],
                    },
                  ],
                  recommendedRow: 1,
                  selected: {
                    mode: "auto",
                    startRow: 1,
                    endRow: 1,
                    headers: ["People Group", "Country"],
                    fingerprint: "smoke-fingerprint",
                    confidence: "high",
                  },
                  sampleRows: [["Khmu", "Laos"]],
                },
              }),
            });
          },
        );
        await page.route(
          "**/api/admin/api-connections/google-sheets/connect",
          async (route) => {
            expect(route.request().postDataJSON()).toMatchObject({
              selectedSheetIds: [1],
              datasetClassification: "PGAC",
              isWorkspaceVisible: false,
            });
            await route.fulfill({
              status: 201,
              contentType: "application/json",
              body: JSON.stringify({
                connections: [
                  {
                    id: "11111111-1111-4111-8111-111111111111",
                    name: "Smoke Sheet - People",
                    datasetName: "Smoke Sheet - People",
                    targetDatasetId: null,
                  },
                ],
              }),
            });
          },
        );
        await page.route(
          "**/api/admin/api-connections/11111111-1111-4111-8111-111111111111/run",
          async (route) => {
            await route.fulfill({
              status: 202,
              contentType: "application/json",
              body: JSON.stringify({
                run: {
                  id: "22222222-2222-4222-8222-222222222222",
                  status: "success",
                  datasetId: "33333333-3333-4333-8333-333333333333",
                },
              }),
            });
          },
        );

        await page.goto("/dashboard/datasets/new");
        await expect(
          page.locator('[data-smoke-page="dataset-onboarding"]'),
        ).toBeVisible();
        await page.getByRole("button", { name: /Google Sheet/ }).click();
        await page
          .getByLabel("Google Sheet link")
          .fill("https://docs.google.com/spreadsheets/d/smoke_sheet/edit");
        await page.getByRole("button", { name: "Check access" }).click();
        await expect(page.getByText("Access confirmed")).toBeVisible();
        await page.getByLabel("People").check();
        await expect(page.getByText("high confidence")).toBeVisible();
        await page
          .getByRole("button", { name: "Review dataset details" })
          .click();
        await expect(
          page.locator("[data-smoke-dataset-private-tag]"),
        ).toHaveCount(0);
        await page.getByRole("radio", { name: /Only administrators/ }).click();
        await expect(
          page.locator("[data-smoke-dataset-private-tag]"),
        ).toContainText("Private");
        await page.getByRole("button", { name: "Review import" }).click();
        await expect(page.getByText("Only administrators", { exact: true })).toBeVisible();
        await page
          .getByRole("button", { name: "Connect and import datasets" })
          .click();
        await expect(
          page.getByRole("heading", { name: "Import complete" }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: "Open dataset" })).toHaveAttribute(
          "href",
          "/dashboard/datasets/33333333-3333-4333-8333-333333333333",
        );
      },
    );
  },
);

test(
  "admin can review a private CSV dataset before upload",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can review a private CSV dataset before upload",
      async () => {
        await page.goto("/dashboard/datasets/new?source=csv");
        await expect(
          page.locator('[data-smoke-page="dataset-onboarding"]'),
        ).toBeVisible();
        await page
          .locator('[data-smoke-upload-input="dataset-onboarding-csv"]')
          .setInputFiles(getDatasetReplacementFixturePath());
        await expect(page.getByText(/Nothing has been uploaded/)).toBeVisible();
        await page
          .getByRole("button", { name: "Review dataset details" })
          .click();
        await page.getByRole("radio", { name: /Only administrators/ }).click();
        await expect(
          page.locator("[data-smoke-dataset-private-tag]"),
        ).toContainText("Private");
        await page.getByRole("button", { name: "Review import" }).click();
        await expect(page.getByText("Only administrators", { exact: true })).toBeVisible();
        await expect(page.getByText(/has not been uploaded yet/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Upload dataset" })).toBeEnabled();
      },
    );
  },
);

test(
  "admin can inspect connection run detail",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney("admin can inspect connection run detail", async () => {
      const connectionId = "6f9f6ef2-1188-4f71-9c24-ef01debf7a01";
      const runId = "77777777-7777-4777-8777-777777777777";

      await page.route(
        `**/api/admin/api-connections/${connectionId}/run`,
        async (route) => {
          expect(route.request().postDataJSON()).toEqual({
            importEnabled: false,
          });
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify({
              run: {
                id: runId,
                connectionId,
                actorOwnerId: "smoke-admin",
                actorEmail: "smoke-runner@example.com",
                mode: "test",
                status: "success",
                httpStatus: 200,
                durationMs: 125,
                rowCount: 1,
                datasetId: null,
                errorMessage: null,
                responsePreview: '[{"name":"Smoke"}]',
                startedAt: "2026-07-20T16:00:00.000Z",
                completedAt: "2026-07-20T16:00:00.125Z",
                createdAt: "2026-07-20T16:00:00.000Z",
                logs: [
                  {
                    id: "88888888-8888-4888-8888-888888888888",
                    runId,
                    connectionId,
                    level: "info",
                    message: "Smoke run completed.",
                    createdAt: "2026-07-20T16:00:00.125Z",
                  },
                ],
                output: null,
              },
            }),
          });
        },
      );

      await page.goto(`/dashboard/api-connections/${connectionId}`);
      await expect(
        page.locator('[data-smoke-page="api-connection-detail"]'),
      ).toBeVisible();
      await expect(page.getByText("Run history", { exact: true })).toBeVisible();
      await page.locator("[data-smoke-api-connection-test]").click();

      const runTrigger = page.locator(
        '[data-smoke-trigger="api-connection-run-detail-sheet"]',
        { hasText: "smoke-runner@example.com" },
      );
      await expect(runTrigger).toBeVisible();
      await runTrigger.click();

      const detailSheet = page.locator(
        '[data-smoke-surface="api-connection-run-detail-sheet"][data-smoke-ready="api-connection-run-detail-sheet"]',
      );
      await expect(detailSheet).toBeVisible();
      await expect(
        detailSheet.getByRole("heading", { name: "Run detail" }),
      ).toBeVisible();
      await expect(detailSheet.getByText("Smoke run completed.")).toBeVisible();
      await expect(detailSheet.getByText('[{"name":"Smoke"}]')).toBeVisible();
    });
  },
);

test("admin can review partner export mapping", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney("admin can review partner export mapping", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
    await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
    const mappingTrigger = page.locator(
      '[data-smoke-trigger="partner-export-profile-sheet"]',
    );
    await expect(mappingTrigger).toBeVisible();
    await mappingTrigger.click();
    await expect(
      page.locator(
        '[data-smoke-surface="partner-export-profile-sheet"][data-smoke-ready="partner-export-profile-sheet"]',
      ),
    ).toBeVisible();
    await expect(page.locator('input[value="PG_PeopleID3"]')).toBeVisible();
    await expect(
      page.locator('input[value="PG_AX_unique_PG_ID_PGIC"]'),
    ).toBeVisible();
    await expect(page.getByLabel("Source for PG_ROP3")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-smoke-surface="partner-export-profile-sheet"]'),
    ).toBeHidden();
  });
});

test("authenticated user can save a filtered table", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopPro(testInfo.project.name));

  await runSmokeJourney("authenticated user can save a filtered table", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
    await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
    await page.getByRole("button", { name: "Watchlist filters" }).click();
    await page.getByRole("switch", { name: /^Toggle Watchlist$/ }).click();
    await page.locator("[data-smoke-save-filtered-table]").click();
    await expect(page.getByText(/Saved to dashboard as/)).toBeVisible();

    await page.goto("/dashboard");
    const savedTableRow = page.locator("[data-smoke-saved-table-row]").first();

    await expect(savedTableRow).toBeVisible();
    await savedTableRow
      .locator('[data-smoke-trigger="saved-table-detail-sheet"]')
      .click();
    await expect(
      page.locator('[data-smoke-ready="saved-table-detail-sheet"]'),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-smoke-surface="saved-table-detail-sheet"]'),
    ).toBeHidden();
  });
});

test("basic user can filter and download without saving", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopBasic(testInfo.project.name));

  await runSmokeJourney("basic user can filter and download without saving", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
    await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
    await page.getByRole("button", { name: "Watchlist filters" }).click();
    await page.getByRole("switch", { name: /^Toggle Watchlist$/ }).click();
    await expect(page.locator("[data-smoke-save-filtered-table]")).toBeHidden();
    await expect(page.locator("[data-smoke-filtered-table-download]")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-smoke-filtered-table-download]").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain(".csv");
  });
});

test("pro reuses warmed primary dataset rows for derived dataset cards", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopPro(testInfo.project.name));

  await runSmokeJourney(
    "pro reuses warmed primary dataset rows for derived dataset cards",
    async () => {
      const bootstrap = await readUiSmokeBootstrap();
      const rowRequests: string[] = [];

      page.on("request", (request) => {
        const url = request.url();

        if (url.includes("/api/datasets/") && url.includes("/rows?")) {
          rowRequests.push(url);
        }
      });

      await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
      await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
      await expect(page.getByText("Rana Tharu")).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: `${bootstrap.datasets.primary.classification} Dataset`,
        }),
      ).toBeVisible();
      await expect.poll(
        () =>
          rowRequests.filter((url) =>
            url.includes(`/api/datasets/${bootstrap.datasets.primary.id}/rows?`),
          ).length,
      ).toBeGreaterThan(0);

      const warmRequestCount = rowRequests.length;

      await page.getByRole("link", { name: "Back to dashboard" }).click();
      await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
      await page.locator(`[data-smoke-dataset-row="${bootstrap.datasets.derived.id}"]`).click();
      await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: `${bootstrap.datasets.derived.classification} Dataset`,
        }),
      ).toBeVisible();
      await expect(page.getByText("Rana Tharu")).toBeVisible();
      await expect(rowRequests).toHaveLength(warmRequestCount);
    },
  );
});

test("admin can edit a field definition", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney("admin can edit a field definition", async () => {
    const bootstrap = await readUiSmokeBootstrap();
    const originalDisplayLabel = "People ID";
    const originalDefinition =
      "Unique people group identifier used across the workspace.";
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
    await page.locator("[data-smoke-field-definition-display-label]").fill(nextDisplayLabel);
    await page.locator("[data-smoke-field-definition-definition]").fill(nextDefinition);
    await page.locator("[data-smoke-field-definition-save]").click();
    await expect(
      page.locator('[data-smoke-surface="field-definition-edit-sheet"]'),
    ).toBeHidden();
    await expect(
      getFieldDefinitionNameLocator(page, bootstrap.fieldDefinitions.editable.id),
    ).toContainText(nextDisplayLabel);

    await page
      .locator(
        `[data-smoke-field-definition-id="${bootstrap.fieldDefinitions.editable.id}"][data-smoke-trigger="field-definition-edit-sheet"]`,
      )
      .first()
      .click();
    await page.locator("[data-smoke-field-definition-display-label]").fill(originalDisplayLabel);
    await page.locator("[data-smoke-field-definition-definition]").fill(originalDefinition);
    await page.locator("[data-smoke-field-definition-save]").click();
    await expect(
      getFieldDefinitionNameLocator(page, bootstrap.fieldDefinitions.editable.id),
    ).toContainText(originalDisplayLabel);
  });
});

test("admin can review field source mappings", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney(
    "admin can review field source mappings",
    async () => {
      const bootstrap = await readUiSmokeBootstrap();

      await page.goto("/dashboard/field-sources");
      await expect(
        page.getByText(
          "Review which source fields currently map to each shared workspace field. These mappings are available here as read-only reference data.",
        ),
      ).toBeVisible();
      await expect(
        getFieldSourceColumnLocator(page, bootstrap.fieldSourceTypes.editable.label),
      ).toBeVisible();

      const fieldSourceValue = page.locator(
        `[data-smoke-field-source-value="${bootstrap.fieldDefinitions.editable.id}:${bootstrap.fieldSourceTypes.editable.id}"]`,
      );
      await expect(fieldSourceValue).toContainText("people_id");
    },
  );
});

test("admin can replace a dataset through the real upload flow", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney("admin can replace a dataset through the real upload flow", async () => {
    const bootstrap = await readUiSmokeBootstrap();

    await page.goto(`/dashboard/upload?replace=${bootstrap.datasets.secondary.id}`);
    await page
      .locator('[data-smoke-upload-input="dataset-upload"]')
      .setInputFiles(getDatasetReplacementFixturePath());
    await expect(page.getByText("Replacement complete")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByText(`${bootstrap.datasets.secondary.fileName} is ready.`),
    ).toBeVisible();
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();

    await page
      .locator(`[data-smoke-dataset-id="${bootstrap.datasets.secondary.id}"]`)
      .click();
    await expect(page.locator('[data-smoke-page="dataset-edit"]')).toBeVisible();
    const revertButtons = page.locator("[data-smoke-dataset-version-revert]");
    const revertCountBefore = await revertButtons.count();
    expect(revertCountBefore).toBeGreaterThanOrEqual(1);

    page.once("dialog", (dialog) => void dialog.accept());
    await revertButtons.first().click();

    await expect(revertButtons).toHaveCount(revertCountBefore + 1);
  });
});

test("admin can assign a filtered dataset view to an admin dataset", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney(
    "admin can assign a filtered dataset view to an admin dataset",
    async () => {
      const bootstrap = await readUiSmokeBootstrap();
      const asiaSouthToggle = page.getByRole("switch", {
        name: "Toggle Asia, South",
        exact: true,
      });

      await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
      await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
      await page.getByRole("button", { name: "Region filters" }).click();
      await asiaSouthToggle.click();
      await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText("2");
      await expect(page.getByText("Rana Tharu")).toBeVisible();
      await expect(page.getByText("Tamang")).toBeVisible();
      await expect(page.getByText("Ribeirinho")).toHaveCount(0);

      await page
        .locator('[data-smoke-trigger="dataset-assign-derived-view-sheet"]')
        .click();
      await expect(
        page.locator('[data-smoke-ready="dataset-assign-derived-view-sheet"]'),
      ).toBeVisible();
      await page.locator("[data-smoke-assign-derived-view-target]").click();
      await page
        .getByRole("option", { name: bootstrap.datasets.secondary.fileName })
        .click();
      await page.locator("[data-smoke-assign-derived-view-submit]").click();
      await expect(
        page.getByText(
          `Assigned filtered view to "${bootstrap.datasets.secondary.fileName}".`,
        ),
      ).toBeVisible();

      await page
        .locator("[data-smoke-assign-derived-view-open-target]")
        .click();
      await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: `${bootstrap.datasets.primary.classification} Dataset`,
        }),
      ).toBeVisible();
      await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText("2");
      await page.getByRole("button", { name: "Region filters" }).click();
      await expect(asiaSouthToggle).toBeChecked();
      await expect(page.getByText("Rana Tharu")).toBeVisible();
      await expect(page.getByText("Tamang")).toBeVisible();
      await expect(page.getByText("Ribeirinho")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Assign to dataset" }),
      ).toBeVisible();
    },
  );
});

test("admin can inspect country reference history", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));
  await runSmokeJourney("admin can inspect country reference history", async () => {
    await page.goto("/dashboard/country-codes");
    await page.locator('[data-smoke-trigger="reference-resource-history"]').click();
    await expect(page.locator('[data-smoke-ready="reference-resource-history"]')).toBeVisible();
    await expect(page.getByText("Reference resource history")).toBeVisible();
  });
});

test("admin can inspect ROP reference history", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));
  await runSmokeJourney("admin can inspect ROP reference history", async () => {
    await page.goto("/dashboard/rop-codes");
    await page.locator('[data-smoke-trigger="reference-resource-history"]').click();
    await expect(page.locator('[data-smoke-ready="reference-resource-history"]')).toBeVisible();
    await expect(page.getByText("Reference resource history")).toBeVisible();
  });
});
