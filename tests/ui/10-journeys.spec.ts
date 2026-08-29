import { expect, test, type Page } from "@playwright/test";

import { readUiSmokeBootstrap } from "./support/bootstrap";
import { getSmokeProjectContext } from "./support/project-context";
import { UI_SMOKE_USERS } from "./support/smoke-data";
import {
  getDatasetNameLocator,
  getDatasetReplacementFixturePath,
  getFieldDefinitionNameLocator,
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

function skipUnlessDesktopAuthenticated(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role === "anonymous" || project.viewport !== "desktop";
}

function skipUnlessMobilePro(projectName: string) {
  const project = getSmokeProjectContext(projectName);
  return project.role !== "pro" || project.viewport !== "mobile";
}

function parseVisibleCount(value: string | null) {
  const numericValue = value?.replace(/[^0-9]/gu, "") ?? "";

  if (!numericValue) {
    throw new Error(`Could not parse a visible record count from ${value ?? "null"}.`);
  }

  return Number.parseInt(numericValue, 10);
}

async function getDatasetFilteredCount(page: Page) {
  return parseVisibleCount(
    await page.locator("[data-smoke-filtered-table-count]").textContent(),
  );
}

async function expectDatasetMapParity(page: Page) {
  await expect.poll(async () => {
    const filtered = await getDatasetFilteredCount(page);
    const mapped = parseVisibleCount(
      await page.locator("[data-smoke-map-mapped-count]").textContent(),
    );
    const unmapped = parseVisibleCount(
      await page.locator("[data-smoke-map-unmapped-count]").textContent(),
    );

    return mapped + unmapped === filtered;
  }).toBe(true);

  const filtered = await getDatasetFilteredCount(page);
  const mapped = parseVisibleCount(
    await page.locator("[data-smoke-map-mapped-count]").textContent(),
  );
  const unmapped = parseVisibleCount(
    await page.locator("[data-smoke-map-unmapped-count]").textContent(),
  );

  expect(mapped + unmapped).toBe(filtered);
  return { filtered, mapped, unmapped };
}

async function getDatasetMapVisualPalette(page: Page) {
  return page.evaluate(() => {
    const map = document.querySelector<HTMLElement>(
      '[data-smoke-surface="dataset-map"] .leaflet-container',
    );
    const selectedCountry = document.querySelector<SVGElement>(
      '[aria-label^="Select "][stroke="var(--dataset-map-selected)"]',
    );
    const swatches = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-smoke-map-legend-swatch]",
      ),
      (swatch) => getComputedStyle(swatch).backgroundColor,
    );

    return {
      canvas: map ? getComputedStyle(map).backgroundColor : "",
      selectedStroke: selectedCountry
        ? getComputedStyle(selectedCountry).stroke
        : "",
      swatches,
    };
  });
}

async function expectDatasetWorkspaceAlignment(page: Page) {
  const filterWorkspace = page.locator(
    '[data-smoke-filter-workspace="combined"]',
  );
  const tableViewport = page.locator(
    "[data-smoke-dataset-table-viewport]",
  );
  const [filterBox, tableBox] = await Promise.all([
    filterWorkspace.boundingBox(),
    tableViewport.boundingBox(),
  ]);

  expect(filterBox).not.toBeNull();
  expect(tableBox).not.toBeNull();
  expect(
    Math.abs((filterBox?.height ?? 0) - (tableBox?.height ?? 0)),
  ).toBeLessThanOrEqual(4);

  const [filterBackground, tableBackground] = await Promise.all([
    filterWorkspace.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    tableViewport.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ]);

  expect(tableBackground).toBe(filterBackground);
}

async function openMapPreproductionDataset(page: Page) {
  const bootstrap = await readUiSmokeBootstrap();

  await page.goto(
    `/dashboard/datasets/${bootstrap.datasets.mapPreproduction.id}`,
  );
  await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
  await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText(
    bootstrap.datasets.mapPreproduction.defaultFilteredRowCount.toLocaleString(),
  );

  return bootstrap;
}

async function openLargeDatasetMap(page: Page) {
  const bootstrap = await openMapPreproductionDataset(page);
  const startedAt = Date.now();

  await page.locator('[data-smoke-trigger="dataset-map"]').click();
  await expect(
    page.locator(
      '[data-smoke-surface="dataset-map"] [data-smoke-ready="dataset-map"]',
    ),
  ).toBeVisible({ timeout: 30_000 });

  return { bootstrap, readyInMs: Date.now() - startedAt };
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

const PIPELINE_SMOKE_RUN_ID = "55555555-5555-4555-8555-555555555555";
const PIPELINE_SMOKE_STAGE_ID = "55555555-5555-4555-8555-555555555556";

type PipelineSmokeStatus =
  | "queued"
  | "awaiting_review"
  | "succeeded"
  | "failed";

function createPipelineSmokeDetail(status: PipelineSmokeStatus) {
  const isTerminal = status === "succeeded" || status === "failed";
  const stageStatus =
    status === "awaiting_review"
      ? "awaiting_review"
      : status === "succeeded"
        ? "succeeded"
        : status === "failed"
          ? "failed"
          : "queued";
  const currentStageKey =
    status === "succeeded" ? null : "imb-people-groups-review";
  const warningCount = status === "awaiting_review" ? 1 : 0;
  const errorCount = status === "failed" ? 1 : 0;

  return {
    id: PIPELINE_SMOKE_RUN_ID,
    definitionKey: "source-imb-people-groups",
    definitionVersion: "pipeline-operations-v1",
    definitionChecksum: "a".repeat(64),
    correlationId: "smoke-pipeline-correlation",
    launchKind: "manual",
    inputFingerprint: "b".repeat(64),
    status,
    currentStageKey,
    actorOwnerId: "smoke-admin",
    actorEmail: "smoke-admin@accelerate-global.test",
    progressCurrent: status === "succeeded" ? 4 : 2,
    progressTotal: 4,
    rowCount: 1,
    warningCount,
    errorCount,
    publicationId:
      status === "succeeded"
        ? "55555555-5555-4555-8555-555555555559"
        : null,
    outOfDate: false,
    errorCode: status === "failed" ? "SMOKE_STAGE_FAILED" : null,
    errorMessage: status === "failed" ? "Mock source stage failed." : null,
    stageCount: 4,
    completedStageCount: status === "succeeded" ? 4 : 2,
    retryCount: status === "queued" ? 1 : 0,
    startedAt: "2026-07-22T16:00:00.000Z",
    completedAt: isTerminal ? "2026-07-22T16:01:00.000Z" : null,
    createdAt: "2026-07-22T16:00:00.000Z",
    updatedAt: "2026-07-22T16:01:00.000Z",
    exactInputs: {
      connectionIds: {
        "imb-people-groups": "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
      },
      publicationIds: {
        source: "55555555-5555-4555-8555-555555555558",
      },
    },
    stages: [
      {
        id: PIPELINE_SMOKE_STAGE_ID,
        key: "imb-people-groups-review",
        index: 2,
        kind: "review",
        effectKey: "manual-review",
        status: stageStatus,
        maxAttempts: 1,
        attemptCount: 1,
        progressCurrent: 1,
        progressTotal: 1,
        exactInputs: {
          sourcePublicationId: "55555555-5555-4555-8555-555555555558",
        },
        output: { candidateId: "smoke-candidate" },
        findingSummary: { warningCount, errorCount },
        errorCode: status === "failed" ? "SMOKE_STAGE_FAILED" : null,
        errorMessage:
          status === "failed" ? "Mock source stage failed." : null,
        startedAt: "2026-07-22T16:00:30.000Z",
        completedAt: isTerminal ? "2026-07-22T16:01:00.000Z" : null,
        attempts: [
          {
            id: "55555555-5555-4555-8555-555555555557",
            attemptNumber: 1,
            workerId: "smoke-worker",
            status:
              status === "failed"
                ? "failed"
                : status === "awaiting_review"
                  ? "awaiting_review"
                  : "succeeded",
            retryable: status === "failed",
            progress: { current: 1, total: 1 },
            output: { candidateId: "smoke-candidate" },
            findingSummary: { warningCount, errorCount },
            errorCode: status === "failed" ? "SMOKE_STAGE_FAILED" : null,
            errorMessage:
              status === "failed" ? "Mock source stage failed." : null,
            startedAt: "2026-07-22T16:00:30.000Z",
            heartbeatAt: "2026-07-22T16:01:00.000Z",
            completedAt: isTerminal
              ? "2026-07-22T16:01:00.000Z"
              : null,
          },
        ],
      },
    ],
    events: [],
  };
}

function pipelineSmokeSummary(
  detail: ReturnType<typeof createPipelineSmokeDetail>,
) {
  return Object.fromEntries(
    Object.entries(detail).filter(
      ([key]) => !["exactInputs", "stages", "events"].includes(key),
    ),
  );
}

function createSourceSmokeRun(input: {
  connectionId: string;
  runId: string;
  sourceProfileKey: string;
  engineKey: string;
  engineLabel: string;
  actorEmail: string;
}) {
  return {
    id: input.runId,
    connectionId: input.connectionId,
    sourceProfileSnapshot: {
      schemaVersion: 1,
      connectionId: input.connectionId,
      sourceProfileKey: input.sourceProfileKey,
      sourceProfileLabel: input.engineLabel,
      stableKeyColumn: null,
      configurable: false,
      engineKey: input.engineKey,
      engineLabel: input.engineLabel,
      engineVersion: `${input.engineKey}-smoke-v1`,
      engineChecksum: "a".repeat(64),
      artifactSchemaVersion: 1,
      publicationTargetKey: `source:${input.sourceProfileKey}`,
    },
    sourceProfileChecksum: "b".repeat(64),
    actorOwnerId: "smoke-admin",
    actorEmail: input.actorEmail,
    mode: "import",
    status: "success",
    httpStatus: 200,
    durationMs: 125,
    rowCount: 1,
    datasetId: null,
    errorMessage: null,
    responsePreview: '[{"record_id":"smoke-1","name":"Smoke"}]',
    startedAt: "2026-07-22T16:00:00.000Z",
    completedAt: "2026-07-22T16:00:00.125Z",
    createdAt: "2026-07-22T16:00:00.000Z",
    logs: [
      {
        id: `${input.runId.slice(0, -1)}9`,
        runId: input.runId,
        connectionId: input.connectionId,
        level: "info",
        message: "Mock source ingestion completed.",
        createdAt: "2026-07-22T16:00:00.125Z",
      },
    ],
    output: null,
  };
}

function createSourceFormingCandidate(input: {
  connectionId: string;
  runId: string;
  formingRunId: string;
  sourceProfileKey: string;
  engineKey: string;
  engineLabel: string;
  status: "valid" | "published";
}) {
  const published = input.status === "published";
  return {
    id: input.formingRunId,
    connectionId: input.connectionId,
    sourceRunId: input.runId,
    resourceSetId: "66666666-6666-4666-8666-666666666661",
    resourceSetChecksum: "c".repeat(64),
    countryVersionId: "66666666-6666-4666-8666-666666666662",
    ropVersionId: "66666666-6666-4666-8666-666666666663",
    sourceProfileKey: input.sourceProfileKey,
    engineKey: input.engineKey,
    engineLabel: input.engineLabel,
    artifactSchemaVersion: 1,
    inputFingerprint: "d".repeat(64),
    publicationTargetKey: `source:${input.sourceProfileKey}`,
    expectedCurrentPublicationId: null,
    resourceBindings: [],
    actorOwnerId: "smoke-admin",
    actorEmail: "smoke-admin@accelerate-global.test",
    status: input.status,
    sourceRowsChecksum: "e".repeat(64),
    sourceRawChecksum: "f".repeat(64),
    fieldContractVersion: 1,
    fieldContractChecksum: "1".repeat(64),
    transformationVersion: `${input.engineKey}-smoke-v1`,
    transformationChecksum: "2".repeat(64),
    inputRowCount: 1,
    outputRowCount: 1,
    warningCount: 0,
    errorCount: 0,
    validationSummary: {
      warningCount: 0,
      errorCount: 0,
      unresolvedCountryRows: 0,
      unresolvedRopRows: 0,
      countryConflictRows: 0,
      ropParentConflictRows: 0,
      invalidValueCount: 0,
      schemaDriftFields: [],
    },
    artifactManifest: {},
    outputChecksum: "3".repeat(64),
    outputSizeBytes: 256,
    datasetId: published
      ? "66666666-6666-4666-8666-666666666664"
      : null,
    publicationId: published
      ? "66666666-6666-4666-8666-666666666665"
      : null,
    downstreamIdentityRun: published
      ? {
          runId: "66666666-6666-4666-8666-666666666666",
          status: "published",
          publicationId: "66666666-6666-4666-8666-666666666667",
          registryRevisionId: "66666666-6666-4666-8666-666666666668",
        }
      : null,
    rejectionReason: null,
    rejectedByOwnerId: null,
    rejectedAt: null,
    publicationReason: published ? "Smoke candidate approved" : null,
    warningsAcknowledged: false,
    publishedByOwnerId: published ? "smoke-admin" : null,
    publishedAt: published ? "2026-07-22T16:02:00.000Z" : null,
    publishingStartedAt: null,
    errorMessage: null,
    startedAt: "2026-07-22T16:01:00.000Z",
    completedAt: "2026-07-22T16:01:01.000Z",
    createdAt: "2026-07-22T16:01:00.000Z",
    findings: [],
    findingsTruncated: false,
  };
}

async function runSourceCandidateLifecycle(
  page: Page,
  input: {
    connectionId: string;
    runId: string;
    formingRunId: string;
    sourceProfileKey: string;
    engineKey: string;
    engineLabel: string;
    actorEmail: string;
    googleSheetsSource?: boolean;
  },
) {
  const sourceRun = createSourceSmokeRun(input);
  let formingRun:
    | ReturnType<typeof createSourceFormingCandidate>
    | null = null;

  await page.route(
    `**/api/admin/api-connections/${input.connectionId}/run`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ importEnabled: true });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ run: sourceRun }),
      });
    },
  );
  await page.route(
    `**/api/admin/api-connections/${input.connectionId}/runs/${input.runId}/forming-candidates**`,
    async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            formingRuns: formingRun ? [formingRun] : [],
          }),
        });
        return;
      }
      if (pathname.endsWith("/publish")) {
        expect(request.postDataJSON()).toEqual({
          reason: "Smoke candidate approved",
          warningsAcknowledged: false,
        });
        formingRun = createSourceFormingCandidate({
          ...input,
          status: "published",
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ formingRun }),
        });
        return;
      }
      formingRun = createSourceFormingCandidate({
        ...input,
        status: "valid",
      });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ formingRun }),
      });
    },
  );

  await page.goto(`/dashboard/api-connections/${input.connectionId}`);
  await expect(
    page.locator('[data-smoke-page="api-connection-detail"]'),
  ).toBeVisible();
  if (input.googleSheetsSource) {
    await page
      .locator('[data-smoke-trigger="google-sheets-source"]')
      .click();
    const sourceSheet = page.locator(
      '[data-smoke-surface="google-sheets-source"][data-smoke-ready="google-sheets-source"]',
    );
    await expect(sourceSheet).toBeVisible();
    await expect(sourceSheet.getByText("Google Sheets source")).toBeVisible();
    await sourceSheet.locator('[data-smoke-close="google-sheets-source"]').click();
    await expect(sourceSheet).toBeHidden();
  }
  await page.locator("[data-smoke-api-connection-import]").click();
  const runTrigger = page.locator(
    '[data-smoke-trigger="api-connection-run-detail-sheet"]',
    { hasText: input.actorEmail },
  );
  await expect(runTrigger).toBeVisible();
  await runTrigger.click();
  const candidateSurface = page.locator(
    '[data-smoke-surface="imb-forming-candidate-review"][data-smoke-ready="imb-forming-candidate-review"]',
  );
  await expect(candidateSurface).toBeVisible();
  await candidateSurface.locator("[data-smoke-forming-build]").click();
  await expect(candidateSurface.getByText("Ready for review")).toBeVisible();
  await candidateSurface.getByLabel("Decision reason").fill(
    "Smoke candidate approved",
  );
  await candidateSurface.locator("[data-smoke-forming-publish]").click();
  await expect(
    candidateSurface.getByText("Published", { exact: true }),
  ).toBeVisible();
  await expect(
    candidateSurface.locator("[data-smoke-downstream-identity-lineage]"),
  ).toBeVisible();
  await expect(
    candidateSurface.locator("[data-smoke-downstream-identity-run-link]"),
  ).toHaveAttribute(
    "href",
    "/admin/identity-registry?runId=66666666-6666-4666-8666-666666666666",
  );
  await expect(
    candidateSurface.getByText("66666666-6666-4666-8666-666666666667"),
  ).toBeVisible();
  await expect(
    candidateSurface.getByText("66666666-6666-4666-8666-666666666668"),
  ).toBeVisible();
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

test("admin can ask private data chat synthetic question", async ({
  page,
}, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney(
    "admin can ask private data chat synthetic question",
    async () => {
      await page.goto("/dashboard/chat");
      await expect(
        page.locator('[data-smoke-page="private-data-chat"]'),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "How many people groups are in the current primary dataset?",
        })
        .click();
      await expect(page.getByText("people_group_count: 3")).toBeVisible();
      await expect(page.getByText("Data provenance")).toBeVisible();
    },
  );
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
                  status: "queued",
                  mode: "import",
                  datasetId: null,
                  startedAt: null,
                  createdAt: "2026-08-17T18:00:00.000Z",
                },
              }),
            });
          },
        );
        let onboardingPollCount = 0;
        await page.route(
          "**/api/admin/api-connections/11111111-1111-4111-8111-111111111111/runs/22222222-2222-4222-8222-222222222222",
          async (route) => {
            onboardingPollCount += 1;
            const completed = onboardingPollCount > 1;
            await route.fulfill({
              contentType: "application/json",
              body: JSON.stringify({
                run: {
                  id: "22222222-2222-4222-8222-222222222222",
                  connectionId: "11111111-1111-4111-8111-111111111111",
                  status: completed ? "success" : "queued",
                  mode: "import",
                  datasetId: completed
                    ? "33333333-3333-4333-8333-333333333333"
                    : null,
                  errorMessage: null,
                  startedAt: completed ? "2026-08-17T18:00:00.000Z" : null,
                  completedAt: completed ? "2026-08-17T18:00:01.500Z" : null,
                  createdAt: "2026-08-17T18:00:00.000Z",
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
        const ingestionProgress = page.locator(
          "[data-smoke-dataset-ingestion-progress]",
        );
        await expect(ingestionProgress).toBeVisible();
        await expect(
          ingestionProgress.getByRole("progressbar", {
            name: "Smoke Sheet - People ingestion",
          }),
        ).not.toHaveAttribute("aria-valuenow");
        await expect(
          ingestionProgress.getByText("Waiting to ingest", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Import complete" }),
        ).toBeVisible();
        await expect(ingestionProgress).toHaveCount(0);
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
                sourceProfileSnapshot: {
                  schemaVersion: 1,
                  connectionId,
                  sourceProfileKey: "imb-people-groups",
                  sourceProfileLabel: "IMB forming",
                  stableKeyColumn: null,
                  configurable: false,
                  engineKey: "imb",
                  engineLabel: "IMB forming",
                  engineVersion: "imb-smoke-v1",
                  engineChecksum: "a".repeat(64),
                  artifactSchemaVersion: 1,
                  publicationTargetKey: "source:imb-people-groups",
                },
                sourceProfileChecksum: "b".repeat(64),
                actorOwnerId: "smoke-admin",
                actorEmail: "smoke-runner@example.com",
                mode: "test",
                status: "queued",
                httpStatus: null,
                durationMs: 0,
                rowCount: null,
                datasetId: null,
                errorMessage: null,
                responsePreview: "",
                startedAt: null,
                completedAt: null,
                createdAt: "2026-07-20T16:00:00.000Z",
                logs: [],
                output: null,
              },
            }),
          });
        },
      );
      let connectionPollCount = 0;
      await page.route(
        `**/api/admin/api-connections/${connectionId}/runs/${runId}`,
        async (route) => {
          connectionPollCount += 1;
          const completed = connectionPollCount > 1;
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              run: {
                id: runId,
                connectionId,
                sourceProfileSnapshot: null,
                sourceProfileChecksum: null,
                actorOwnerId: "smoke-admin",
                actorEmail: "smoke-runner@example.com",
                mode: "test",
                status: completed ? "success" : "queued",
                httpStatus: completed ? 200 : null,
                durationMs: completed ? 1625 : 0,
                rowCount: completed ? 1 : null,
                datasetId: null,
                errorMessage: null,
                responsePreview: completed ? '[{"name":"Smoke"}]' : "",
                startedAt: completed ? "2026-07-20T16:00:00.000Z" : null,
                completedAt: completed ? "2026-07-20T16:00:01.625Z" : null,
                createdAt: "2026-07-20T16:00:00.000Z",
                logs: completed
                  ? [
                      {
                        id: "88888888-8888-4888-8888-888888888888",
                        runId,
                        connectionId,
                        level: "info",
                        message: "Smoke run completed.",
                        createdAt: "2026-07-20T16:00:01.625Z",
                      },
                    ]
                  : [],
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

      const testProgress = page.locator("[data-smoke-api-connection-progress]");
      await expect(testProgress).toBeVisible();
      await expect(
        testProgress.getByText("Waiting to test", { exact: true }),
      ).toBeVisible();
      await expect(
        testProgress.getByRole("progressbar", {
          name: "Connection test in progress",
        }),
      ).not.toHaveAttribute("aria-valuenow");
      await expect(testProgress).toHaveCount(0);

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

test(
  "admin can complete a code-managed source candidate lifecycle",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can complete a code-managed source candidate lifecycle",
      async () => {
        const bootstrap = await readUiSmokeBootstrap();
        await runSourceCandidateLifecycle(page, {
          connectionId: bootstrap.aliases.codeManagedSourceConnectionId,
          runId: "77777777-7777-4777-8777-777777777771",
          formingRunId: "77777777-7777-4777-8777-777777777772",
          sourceProfileKey: "imb-people-groups",
          engineKey: "imb",
          engineLabel: "IMB forming",
          actorEmail: "smoke-code-managed@example.com",
        });
      },
    );
  },
);

test(
  "admin can complete a configurable Sheet candidate lifecycle",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can complete a configurable Sheet candidate lifecycle",
      async () => {
        const bootstrap = await readUiSmokeBootstrap();
        await runSourceCandidateLifecycle(page, {
          connectionId:
            bootstrap.aliases.configurableSheetSourceConnectionId,
          runId: "77777777-7777-4777-8777-777777777773",
          formingRunId: "77777777-7777-4777-8777-777777777774",
          sourceProfileKey: "wcd-people-groups",
          engineKey: "wcd",
          engineLabel: "World Christian Database forming",
          actorEmail: "smoke-configurable-sheet@example.com",
          googleSheetsSource: true,
        });
      },
    );
  },
);

test(
  "admin can link an existing Sheet to a data workflow",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can link an existing Sheet to a data workflow",
      async () => {
        const bootstrap = await readUiSmokeBootstrap();
        const connectionId =
          bootstrap.aliases.unassignedSheetSourceConnectionId;
        let submitted: unknown = null;
        await page.route(
          `**/api/admin/api-connections/${connectionId}/workflow`,
          async (route) => {
            submitted = route.request().postDataJSON();
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ assignment: submitted }),
            });
          },
        );
        await page.goto(`/dashboard/api-connections/${connectionId}`);
        await page
          .locator('[data-smoke-trigger="google-sheets-source"]')
          .click();
        await expect(
          page.locator(
            '[data-smoke-surface="google-sheets-source"][data-smoke-ready="google-sheets-source"]',
          ),
        ).toBeVisible();
        await expect(page.getByLabel("Data workflow")).toBeVisible();
        await page.getByLabel("Data workflow").selectOption("tier1-accelerate");
        await page
          .getByLabel("Permanent source-row ID column")
          .selectOption("Record ID");
        await page.getByRole("button", { name: "Link workflow" }).click();
        await expect.poll(() => submitted).toEqual({
          sheetId: 202,
          kind: "tier1",
          sourceProfileKey: "accelerate-owned-people-groups",
          stableKeyColumn: "Record ID",
        });
      },
    );
  },
);

test(
  "admin can manually launch and resume a reviewed pipeline",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can manually launch and resume a reviewed pipeline",
      async () => {
        let status: PipelineSmokeStatus = "awaiting_review";
        await page.route(
          "**/api/admin/pipeline-operations/**",
          async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (
              pathname === "/api/admin/pipeline-operations/runs" &&
              request.method() === "POST"
            ) {
              expect(request.postDataJSON()).toMatchObject({
                definitionKey: "source-imb-people-groups",
                launchKind: "manual",
              });
              const detail = createPipelineSmokeDetail(status);
              await route.fulfill({
                status: 202,
                contentType: "application/json",
                body: JSON.stringify({ run: detail }),
              });
              return;
            }
            if (pathname.endsWith("/review")) {
              expect(request.postDataJSON()).toEqual({
                stageKey: "imb-people-groups-review",
                decision: "approve",
                reason: "Reviewed smoke candidate",
                acknowledgeWarnings: true,
              });
              status = "succeeded";
              await route.fulfill({
                status: 202,
                contentType: "application/json",
                body: JSON.stringify({ accepted: true }),
              });
              return;
            }
            const detail = createPipelineSmokeDetail(status);
            if (pathname === "/api/admin/pipeline-operations/runs") {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  runs: [pipelineSmokeSummary(detail)],
                }),
              });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ run: detail }),
            });
          },
        );

        await page.goto("/admin/pipeline-operations");
        await expect(
          page.locator('[data-smoke-page="pipeline-operations"]'),
        ).toBeVisible();
        await page.locator("[data-smoke-pipeline-launch]").click();
        const detailSheet = page.locator(
          '[data-smoke-surface="pipeline-run-detail"][data-smoke-ready="pipeline-run-detail"]',
        );
        await expect(detailSheet).toBeVisible();
        await expect(
          detailSheet.getByText("Review Required", { exact: true }),
        ).toBeVisible();
        await expect(
          detailSheet.locator("[data-smoke-pipeline-stage-timeline]"),
        ).toBeVisible();
        await detailSheet
          .locator("[data-smoke-pipeline-reason]")
          .fill("Reviewed smoke candidate");
        await detailSheet
          .locator("[data-smoke-pipeline-warning-acknowledgement]")
          .check();
        await detailSheet
          .locator("[data-smoke-pipeline-review-approve]")
          .click();
        await expect(
          detailSheet.getByText("Up To Date", { exact: true }),
        ).toBeVisible();
        await expect(page.getByText("Review approved.")).toBeVisible();
      },
    );
  },
);

test(
  "admin can retry a failed pipeline stage",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can retry a failed pipeline stage",
      async () => {
        let status: PipelineSmokeStatus = "failed";
        await page.route(
          "**/api/admin/pipeline-operations/**",
          async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (
              pathname === "/api/admin/pipeline-operations/runs" &&
              request.method() === "POST"
            ) {
              const detail = createPipelineSmokeDetail(status);
              await route.fulfill({
                status: 202,
                contentType: "application/json",
                body: JSON.stringify({ run: detail }),
              });
              return;
            }
            if (pathname.endsWith("/retry")) {
              expect(request.postDataJSON()).toEqual({
                stageKey: "imb-people-groups-review",
                reason: "Retry mock transient failure",
              });
              status = "queued";
              await route.fulfill({
                status: 202,
                contentType: "application/json",
                body: JSON.stringify({ accepted: true }),
              });
              return;
            }
            const detail = createPipelineSmokeDetail(status);
            if (pathname === "/api/admin/pipeline-operations/runs") {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  runs: [pipelineSmokeSummary(detail)],
                }),
              });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ run: detail }),
            });
          },
        );

        await page.goto("/admin/pipeline-operations");
        await page.locator("[data-smoke-pipeline-launch]").click();
        const detailSheet = page.locator(
          '[data-smoke-surface="pipeline-run-detail"][data-smoke-ready="pipeline-run-detail"]',
        );
        await expect(detailSheet.getByText("Failed", { exact: true })).toBeVisible();
        await detailSheet
          .locator("[data-smoke-pipeline-reason]")
          .fill("Retry mock transient failure");
        await detailSheet.locator("[data-smoke-pipeline-retry]").click();
        await expect(page.getByText("Retry accepted.")).toBeVisible();
        await expect(detailSheet.getByText("Queued", { exact: true })).toBeVisible();
      },
    );
  },
);

test(
  "admin can inspect pipeline run history",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

    await runSmokeJourney(
      "admin can inspect pipeline run history",
      async () => {
        const detail = createPipelineSmokeDetail("succeeded");
        await page.route(
          "**/api/admin/pipeline-operations/**",
          async (route) => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (
              pathname === "/api/admin/pipeline-operations/runs" &&
              request.method() === "POST"
            ) {
              await route.fulfill({
                status: 202,
                contentType: "application/json",
                body: JSON.stringify({ run: detail }),
              });
              return;
            }
            if (pathname === "/api/admin/pipeline-operations/runs") {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  runs: [pipelineSmokeSummary(detail)],
                }),
              });
              return;
            }
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ run: detail }),
            });
          },
        );

        await page.goto("/admin/pipeline-operations");
        await page.locator("[data-smoke-pipeline-launch]").click();
        const detailSheet = page.locator(
          '[data-smoke-surface="pipeline-run-detail"][data-smoke-ready="pipeline-run-detail"]',
        );
        await expect(detailSheet).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(detailSheet).toBeHidden();
        const history = page.locator("[data-smoke-pipeline-history]");
        await expect(history).toBeVisible();
        await history
          .locator('[data-smoke-trigger="pipeline-run-detail"]')
          .click();
        await expect(detailSheet).toBeVisible();
        await expect(
          detailSheet.locator("[data-smoke-pipeline-exact-inputs]"),
        ).toContainText("55555555-5555-4555-8555-555555555558");
        const attemptHistory = detailSheet.locator(
          "[data-smoke-pipeline-attempt-history]",
        );
        await expect(attemptHistory).toBeVisible();
        await attemptHistory.locator("summary").click();
        await expect(attemptHistory).toContainText("#1 · succeeded");
      },
    );
  },
);

test("admin can begin partner export from management sheet", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));

  await runSmokeJourney(
    "admin can begin partner export from management sheet",
    async () => {
      const bootstrap = await readUiSmokeBootstrap();

      await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
      await expect(
        page.locator('[data-smoke-page="dataset-detail"]'),
      ).toBeVisible();
      const datasetToolbar = page.locator("[data-smoke-dataset-toolbar]");
      const viewSwitch = datasetToolbar.getByRole("group", {
        name: "Dataset view",
      });
      const datasetActionsTrigger = datasetToolbar.locator(
        '[data-smoke-trigger="dataset-actions-menu"]',
      );
      await expect(datasetActionsTrigger).toBeVisible();
      await expect(datasetToolbar).toBeVisible();
      await expect(viewSwitch).toBeVisible();
      expect(await datasetToolbar.locator(":scope > *").count()).toBe(2);

      await expectDatasetWorkspaceAlignment(page);

      await datasetActionsTrigger.click();
      const datasetActionsMenu = page.locator(
        '[data-smoke-surface="dataset-actions-menu"][data-smoke-ready="dataset-actions-menu"]',
      );
      await expect(datasetActionsMenu).toBeVisible();
      await expect(
        datasetActionsMenu.getByRole("menuitem", { name: "Edit dataset" }),
      ).toHaveAttribute(
        "href",
        `/dashboard/datasets/${bootstrap.datasets.primary.id}/edit`,
      );
      const managerTrigger = datasetActionsMenu.locator(
        '[data-smoke-trigger="partner-exports-sheet"]',
      );
      await expect(managerTrigger).toBeVisible();
      await managerTrigger.click();
      const managerSheet = page.locator(
        '[data-smoke-surface="partner-exports-sheet"][data-smoke-ready="partner-exports-sheet"]',
      );
      await expect(managerSheet).toBeVisible();

      const mappingTrigger = managerSheet.locator(
        '[data-smoke-trigger="partner-export-profile-sheet"]',
      );
      await expect(mappingTrigger).toBeVisible();
      await mappingTrigger.click();
      await expect(managerSheet).toBeHidden();
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
      await expect(managerSheet).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(managerSheet).toBeHidden();
    },
  );
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

test("authenticated user can explore the filtered dataset map", async ({ page }, testInfo) => {
  test.skip(skipUnlessDesktopPro(testInfo.project.name));

  await runSmokeJourney(
    "authenticated user can explore the filtered dataset map",
    async () => {
      const bootstrap = await readUiSmokeBootstrap();
      const externalMapRequests: string[] = [];
      const boundaryRequests: string[] = [];
      let appOrigin = "";
      let captureMapRequests = false;

      page.on("request", (request) => {
        if (!captureMapRequests) {
          return;
        }

        const requestUrl = new URL(request.url());
        if (requestUrl.pathname === "/map-data/natural-earth-countries-110m.geojson") {
          boundaryRequests.push(request.url());
        }
        if (requestUrl.origin !== appOrigin) {
          externalMapRequests.push(request.url());
        }
      });

      await page.goto(`/dashboard/datasets/${bootstrap.datasets.primary.id}`);
      await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
      await expectDatasetWorkspaceAlignment(page);
      appOrigin = new URL(page.url()).origin;
      captureMapRequests = true;

      await page.locator('[data-smoke-trigger="dataset-map"]').click();
      const mapSurface = page.locator(
        '[data-smoke-surface="dataset-map"] [data-smoke-ready="dataset-map"]',
      );
      await expect(mapSurface).toBeVisible();
      await expect(page.locator("[data-smoke-map-mapped-count]")).toContainText(
        "3 mapped",
      );

      await page.getByRole("button", { name: "Watchlist filters" }).click();
      await page.getByRole("switch", { name: /^Toggle Watchlist$/ }).click();
      await expect(page.locator("[data-smoke-map-mapped-count]")).toContainText(
        "0 mapped",
      );

      await page.getByRole("button", { name: "Table" }).click();
      await expect(
        page.locator('[data-smoke-surface="dataset-map"]'),
      ).toBeHidden();
      await expect(page.getByText("No people groups found.")).toBeVisible();

      expect(boundaryRequests).toHaveLength(1);
      expect(externalMapRequests).toEqual([]);
    },
  );
});

test(
  "pro validates the production-shaped dataset map before release",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopPro(testInfo.project.name));
    testInfo.setTimeout(120_000);

    await runSmokeJourney(
      "pro validates the production-shaped dataset map before release",
      async () => {
        const externalMapRequests: string[] = [];
        const boundaryRequests: string[] = [];
        let appOrigin = "";
        let captureMapRequests = false;

        page.on("request", (request) => {
          if (!captureMapRequests) {
            return;
          }

          const requestUrl = new URL(request.url());
          if (
            requestUrl.pathname ===
            "/map-data/natural-earth-countries-110m.geojson"
          ) {
            boundaryRequests.push(request.url());
          }
          if (requestUrl.origin !== appOrigin) {
            externalMapRequests.push(request.url());
          }
        });

        const bootstrap = await openMapPreproductionDataset(page);
        appOrigin = new URL(page.url()).origin;
        captureMapRequests = true;

        const startedAt = Date.now();
        await page.locator('[data-smoke-trigger="dataset-map"]').click();
        await expect(
          page.locator(
            '[data-smoke-surface="dataset-map"] [data-smoke-ready="dataset-map"]',
          ),
        ).toBeVisible({ timeout: 30_000 });
        expect(Date.now() - startedAt).toBeLessThan(30_000);

        const mapWidthRatio = await page.evaluate(() => {
          const card = document.querySelector<HTMLElement>(
            '[data-smoke-surface="dataset-map"]',
          );
          const map = document.querySelector<HTMLElement>(
            '[data-smoke-surface="dataset-map"] .leaflet-container',
          );
          if (!card || !map) return 0;
          return map.getBoundingClientRect().width / card.getBoundingClientRect().width;
        });
        expect(mapWidthRatio).toBeGreaterThan(0.9);

        const baseline = await expectDatasetMapParity(page);
        expect(baseline.filtered).toBe(
          bootstrap.datasets.mapPreproduction.defaultFilteredRowCount,
        );
        expect(baseline.mapped).toBeGreaterThan(0);
        expect(baseline.unmapped).toBeGreaterThan(0);
        expect(boundaryRequests).toHaveLength(1);
        expect(externalMapRequests).toEqual([]);

        const mapSearch = page.getByLabel("Search this result");
        await mapSearch.fill("Afghanistan");
        await page
          .getByRole("button", { name: /Afghanistan.*Country/u })
          .click();
        const afghanistan = page.locator('[aria-label="Select Afghanistan"]');
        await expect(afghanistan).toHaveAttribute(
          "stroke",
          "var(--dataset-map-selected)",
        );
        expect(
          Number.parseFloat((await afghanistan.getAttribute("stroke-width")) ?? "99"),
        ).toBeLessThanOrEqual(1.5);

        const filteredBeforeAppearanceChange = await getDatasetFilteredCount(page);
        const lightPalette = await getDatasetMapVisualPalette(page);
        expect(new Set(lightPalette.swatches).size).toBe(4);
        expect(lightPalette.canvas).not.toBe("");
        expect(lightPalette.selectedStroke).not.toBe("");

        await page.evaluate(() => document.documentElement.classList.add("dark"));
        await expect
          .poll(async () => JSON.stringify(await getDatasetMapVisualPalette(page)))
          .not.toBe(JSON.stringify(lightPalette));
        const darkPalette = await getDatasetMapVisualPalette(page);
        expect(new Set(darkPalette.swatches).size).toBe(4);
        expect(await getDatasetFilteredCount(page)).toBe(
          filteredBeforeAppearanceChange,
        );
        await expect(page.getByRole("heading", { name: "Afghanistan" })).toBeVisible();

        await page.evaluate(() => document.documentElement.classList.remove("dark"));

        await mapSearch.fill("Tanzania");
        const countryResult = page.getByRole("button", {
          name: /Tanzania.*Country/u,
        });
        await countryResult.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByText("Selected country")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /Tanzania/u }),
        ).toBeVisible();

        await mapSearch.fill(
          bootstrap.datasets.mapPreproduction.focusedPeopleName,
        );
        const peopleResult = page.getByRole("button", {
          name: new RegExp(
            `${bootstrap.datasets.mapPreproduction.focusedPeopleName}.*India`,
            "u",
          ),
        });
        await peopleResult.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByText(
            `Focused match: ${bootstrap.datasets.mapPreproduction.focusedPeopleName}`,
          ),
        ).toBeVisible();

        await page
          .getByRole("checkbox", {
            name: `Select ${bootstrap.datasets.mapPreproduction.focusedPeopleName}`,
          })
          .click();
        await page.locator("[data-smoke-map-view-selected-table]").click();
        await expect(page.locator("[data-smoke-map-table-scope]")).toContainText(
          "1 temporary records",
        );
        await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText(
          "1",
        );

        await page
          .getByText(bootstrap.datasets.mapPreproduction.focusedPeopleName, {
            exact: true,
          })
          .last()
          .click();
        await expect(
          page.locator(
            '[data-smoke-surface="dataset-record-profile-sheet"][data-smoke-ready="dataset-record-profile-sheet"]',
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: bootstrap.datasets.mapPreproduction.focusedPeopleName,
          }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.locator('[data-smoke-surface="dataset-record-profile-sheet"]'),
        ).toBeHidden();

        await page.locator("[data-smoke-clear-map-table-scope]").click();
        await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText(
          bootstrap.datasets.mapPreproduction.defaultFilteredRowCount.toLocaleString(),
        );

        const assertFreshFilter = async (
          applyFilter: () => Promise<void>,
        ) => {
          await openLargeDatasetMap(page);
          await applyFilter();
          await expect.poll(() => getDatasetFilteredCount(page)).toBeLessThan(
            bootstrap.datasets.mapPreproduction.defaultFilteredRowCount,
          );
          const counts = await expectDatasetMapParity(page);
          expect(counts.filtered).toBeGreaterThan(0);
        };

        await assertFreshFilter(async () => {
          await page.getByRole("button", { name: "Region filters" }).click();
          await page
            .getByRole("switch", {
              name: "Toggle Asia, South",
              exact: true,
            })
            .click();
        });

        await assertFreshFilter(async () => {
          await page.getByRole("button", { name: "Country filters" }).click();
          await page.getByRole("button", { name: "Deselect all" }).click();
          await page.getByLabel("Search countries").fill("Brazil");
          await page.getByRole("checkbox", { name: "Include Brazil" }).click();
        });

        await assertFreshFilter(async () => {
          await page.getByRole("switch", { name: "Toggle Watchlist" }).click();
        });

        await assertFreshFilter(async () => {
          await page.getByRole("switch", { name: "Toggle UUPG" }).click();
        });

        await assertFreshFilter(async () => {
          await page.getByRole("switch", { name: "Toggle Hotspots" }).click();
        });

        await openLargeDatasetMap(page);
        await page.getByRole("button", { name: "Country filters" }).click();
        await page.getByRole("button", { name: "Deselect all" }).click();
        await page.getByLabel("Search countries").fill("Canada");
        await page.getByRole("checkbox", { name: "Include Canada" }).click();
        await expect.poll(() => getDatasetFilteredCount(page)).toBeGreaterThan(0);
        await page.getByRole("switch", { name: "Toggle Watchlist" }).click();
        await expect(page.locator("[data-smoke-filtered-table-count]")).toHaveText(
          "0",
        );
        await expect(page.getByText(/No records match the current filters/u)).toBeVisible();
        await expectDatasetMapParity(page);
        await page.getByRole("button", { name: "Table" }).click();
        await expect(page.getByText("No people groups found.")).toBeVisible();
      },
    );
  },
);

test(
  "workspace roles can inspect the production-shaped map without permission leakage",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessDesktopAuthenticated(testInfo.project.name));

    await runSmokeJourney(
      "workspace roles can inspect the production-shaped map without permission leakage",
      async () => {
        const project = getSmokeProjectContext(testInfo.project.name);

        await openLargeDatasetMap(page);
        await expectDatasetMapParity(page);
        if (project.role === "basic") {
          await expect(page.locator("[data-smoke-save-filtered-table]")).toBeHidden();
        } else {
          await expect(page.locator("[data-smoke-save-filtered-table]")).toBeVisible();
        }
      },
    );
  },
);

test(
  "mobile pro can use the production-shaped map in dark appearance",
  async ({ page }, testInfo) => {
    test.skip(skipUnlessMobilePro(testInfo.project.name));

    await runSmokeJourney(
      "mobile pro can use the production-shaped map in dark appearance",
      async () => {
        await page.emulateMedia({ colorScheme: "dark" });
        await openLargeDatasetMap(page);
        await expect(page.locator("html")).toHaveClass(/dark/u);
        await expectDatasetMapParity(page);

        const singaporePoint = page.locator('[aria-label="Select Singapore"]');
        await expect(singaporePoint).toBeVisible();
        await singaporePoint.focus();
        await page.keyboard.press("Enter");
        await expect(singaporePoint).toHaveAttribute(
          "stroke",
          "var(--dataset-map-selected)",
        );
        await expect(
          page.getByRole("heading", { name: "Singapore" }),
        ).toBeVisible();
        const darkPalette = await getDatasetMapVisualPalette(page);
        expect(new Set(darkPalette.swatches).size).toBe(4);
        expect(darkPalette.canvas).not.toBe("");
        expect(darkPalette.selectedStroke).not.toBe("");

        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1,
          ),
        ).toBe(true);
      },
    );
  },
);

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
        page.getByRole("button", { name: "Create dataset from current view" }),
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

test("authenticated user can inspect pipeline reference resource", async ({
  page,
}, testInfo) => {
  test.skip(skipUnlessDesktopAdmin(testInfo.project.name));
  await runSmokeJourney(
    "authenticated user can inspect pipeline reference resource",
    async () => {
      await page.goto("/dashboard/resources");
      await page
        .getByRole("link", { name: /Dataset source aliases/u })
        .click();
      await expect(
        page.locator('[data-smoke-page="pipeline-reference-resource"]'),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Dataset source aliases" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Download CSV" }),
      ).toBeVisible();
      await expect(page.getByText("Accepted aliases")).toBeVisible();
    },
  );
});
