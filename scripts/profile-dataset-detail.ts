import { mkdir, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Request as PlaywrightRequest,
} from "@playwright/test";

import { delay, loadEnvironmentFile, runCommand } from "./lib/command";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_DATASET_ID = "a0f20f00-b902-4485-a796-c1027b7dfc21";
const DEFAULT_QUIET_WINDOW_MS = 1_000;
const DEFAULT_SERVER_START_TIMEOUT_MS = 60_000;
const DEFAULT_BUILD_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_PROFILING_TIMEOUT_MS = 120_000;

const PERF_TMP_DIR = path.join(process.cwd(), ".tmp", "dataset-detail-perf");
const PERF_OUTPUT_DIR = path.join(
  process.cwd(),
  "output",
  "playwright",
  "dataset-detail-perf",
);
const PERF_STORAGE_STATE_PATH = path.join(PERF_TMP_DIR, "auth-state.json");

type ProfileDatasetDetailArgs = {
  baseUrl: string;
  datasetId: string;
  email: string | null;
  password: string | null;
  headed: boolean;
  keepServer: boolean;
  skipBuild: boolean;
  reportSuffix: string | null;
};

type ProfileEnvironmentInput = {
  processEnv: NodeJS.ProcessEnv;
  fileEnv: Record<string, string>;
};

type TableSnapshot = {
  filteredCount: string | null;
  firstRowsSignature: string;
  mountedBodyRows: number;
  mountedBodyCells: number;
  headerCellCount: number;
  visibleRowIds: string[];
};

type CountryOptionsSnapshot = {
  searchValue: string;
  visibleOptionCount: number;
  visibleOptionsSignature: string;
};

type TrackedRequest = {
  url: string;
  method: string;
  resourceType: string;
  startedAt: number;
  finishedAt: number | null;
  status: number | null;
  failed: boolean;
  isRowRequest: boolean;
};

type RequestTracker = {
  requests: TrackedRequest[];
  inFlightRowRequests: number;
  lastRowActivityAt: number;
  dispose: () => void;
};

type LongTaskRecord = {
  startTime: number;
  duration: number;
  name: string;
};

type RenderTraceBucket = {
  count: number;
  keys: Record<string, number>;
};

type RenderTraceProfilerEvent = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

type RawRenderTraceSnapshot = {
  renders: Record<string, RenderTraceBucket>;
  profilerEvents: RenderTraceProfilerEvent[];
  timings: Record<
    string,
    {
      count: number;
      totalDurationMs: number;
      maxDurationMs: number;
    }
  >;
};

type RawSortTraceBucket = {
  modeDetectionCount: number;
  modeDetectionDurationMs: number;
  detectedTextCount: number;
  detectedAlphanumericCount: number;
  compareCount: number;
  compareDurationMs: number;
  textCompareCount: number;
  textCompareDurationMs: number;
  alphanumericCompareCount: number;
  alphanumericCompareDurationMs: number;
  keyBuildCount: number;
  keyBuildDurationMs: number;
  tokenBuildCount: number;
  tokenBuildDurationMs: number;
};

type RawSortTraceSnapshot = {
  columns: Record<string, RawSortTraceBucket>;
};

type RenderTraceSummary = {
  components: Array<{
    name: string;
    count: number;
    distinctKeys: number;
    topKeys: Array<{
      key: string;
      count: number;
    }>;
  }>;
  profilers: Array<{
    id: string;
    count: number;
    totalActualDuration: number;
    maxActualDuration: number;
    totalBaseDuration: number;
  }>;
  timings: Array<{
    name: string;
    count: number;
    totalDurationMs: number;
    maxDurationMs: number;
    averageDurationMs: number;
  }>;
};

type SortTraceSummary = Array<{
  columnId: string;
  modeDetectionCount: number;
  modeDetectionDurationMs: number;
  detectedTextCount: number;
  detectedAlphanumericCount: number;
  compareCount: number;
  compareDurationMs: number;
  textCompareCount: number;
  textCompareDurationMs: number;
  alphanumericCompareCount: number;
  alphanumericCompareDurationMs: number;
  keyBuildCount: number;
  keyBuildDurationMs: number;
  tokenBuildCount: number;
  tokenBuildDurationMs: number;
}>;

type InteractionReport = {
  name:
    | "warm-sort-desc"
    | "warm-watchlist-enable"
    | "warm-region-toggle"
    | "warm-country-search"
    | "warm-country-toggle";
  durationMs: number;
  rowRequestCount: number;
  totalRequestCount: number;
  networkRequests: Array<{
    url: string;
    method: string;
    resourceType: string;
    status: number | null;
    failed: boolean;
  }>;
  longTaskCount: number;
  maxLongTaskMs: number;
  mountedBodyRows: number;
  mountedBodyCells: number;
  headerCellCount: number;
  visibleRowOverlapCount: number;
  before: string;
  after: string;
  renderTrace?: RenderTraceSummary;
  sortTrace?: SortTraceSummary;
};

type ProfileDatasetDetailReport = {
  generatedAt: string;
  baseUrl: string;
  datasetId: string;
  supabaseUrl: string;
  authenticatedEmail: string;
  routeProof: {
    url: string;
    filteredCount: string | null;
    mountedBodyRows: number;
    mountedBodyCells: number;
    headerCellCount: number;
    storageStatePath: string;
    screenshotPath: string;
  };
  interactions: InteractionReport[];
};

function buildPerfArtifactPaths(reportSuffix: string | null) {
  const suffix = reportSuffix ? `-${reportSuffix}` : "";

  return {
    reportPath: path.join(PERF_OUTPUT_DIR, `report${suffix}.json`),
    screenshotPath: path.join(
      PERF_OUTPUT_DIR,
      `dataset-detail-loaded${suffix}.png`,
    ),
  };
}

type ServerHandle = {
  child: ChildProcess;
};

declare global {
  interface Window {
    __datasetDetailPerfLongTasks?: LongTaskRecord[];
    __datasetDetailPerfRenderTrace?: RawRenderTraceSnapshot & {
      enabled: boolean;
    };
    __datasetDetailPerfSortTrace?: RawSortTraceSnapshot & {
      enabled: boolean;
    };
    __datasetDetailPerfHelpers?: {
      readTableSnapshot: () => TableSnapshot;
      readCountryOptionsSnapshot: () => CountryOptionsSnapshot;
      readTableSignature: () => string;
      toggleVisibleCountry: (countryName: string) => boolean;
      isVisibleCountryChecked: (countryName: string) => boolean;
      resetRenderTrace: () => void;
      readRenderTrace: () => RawRenderTraceSnapshot;
      resetSortTrace: () => void;
      readSortTrace: () => RawSortTraceSnapshot;
    };
  }
}

const PERF_PAGE_INIT_SCRIPT = `
(() => {
  window.__datasetDetailPerfLongTasks = [];
  window.__datasetDetailPerfRenderTrace = {
    enabled: true,
    renders: {},
    profilerEvents: [],
    timings: {},
  };
  window.__datasetDetailPerfSortTrace = {
    enabled: true,
    columns: {},
  };

  const normalizeText = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const findVisibleElement = (selector) =>
    Array.from(document.querySelectorAll(selector)).find((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return element.offsetParent !== null || element.getClientRects().length > 0;
    }) ?? null;
  const getVisibleCountryRoot = () => {
    const input = findVisibleElement('input[aria-label="Search countries"]');
    return input?.parentElement?.parentElement?.parentElement ?? null;
  };
  const getMountedBodyRows = () =>
    Array.from(
      document.querySelectorAll('[data-dataset-perf-body-row="true"]'),
    ).filter((row) => row instanceof HTMLElement);
  const getBodyCells = (root) =>
    Array.from(root?.querySelectorAll?.('[data-dataset-perf-body-cell="true"]') ?? []);

  const readTableSnapshot = () => {
    const rows = getMountedBodyRows();
    const firstRowsSignature = rows
      .slice(0, 5)
      .map((row) =>
        getBodyCells(row)
          .slice(0, 5)
          .map((cell) => normalizeText(cell.textContent))
          .join("|"),
      )
      .join("||");

    return {
      filteredCount:
        document.querySelector("[data-smoke-filtered-table-count]")?.textContent?.trim() ?? null,
      firstRowsSignature,
      mountedBodyRows: rows.length,
      mountedBodyCells: document.querySelectorAll('[data-dataset-perf-body-cell="true"]').length,
      headerCellCount: document.querySelectorAll("thead th").length,
      visibleRowIds: rows
        .map((row) => row.getAttribute("data-row-id"))
        .filter((value) => typeof value === "string" && value.length > 0),
    };
  };

  const readCountryOptionsSnapshot = () => {
    const input = findVisibleElement('input[aria-label="Search countries"]');
    const root = getVisibleCountryRoot();
    const labels = Array.from(root?.querySelectorAll("label") ?? [])
      .map((label) => normalizeText(label.textContent))
      .filter(Boolean);

    return {
      searchValue: input?.value ?? "",
      visibleOptionCount: labels.length,
      visibleOptionsSignature: labels.slice(0, 20).join("||"),
    };
  };
  const toggleVisibleCountry = (countryName) => {
    const root = getVisibleCountryRoot();
    const checkbox = root?.querySelector(
      '[role="checkbox"][aria-label="' + 'Include ' + countryName + '"]',
    );

    if (!(checkbox instanceof HTMLElement)) {
      return false;
    }

    checkbox.click();
    return true;
  };
  const isVisibleCountryChecked = (countryName) => {
    const root = getVisibleCountryRoot();
    const checkbox = root?.querySelector(
      '[role="checkbox"][aria-label="' + 'Include ' + countryName + '"]',
    );

    return checkbox?.getAttribute("aria-checked") === "true";
  };

  window.__datasetDetailPerfHelpers = {
    readTableSnapshot,
    readCountryOptionsSnapshot,
    readTableSignature: () => readTableSnapshot().firstRowsSignature,
    toggleVisibleCountry,
    isVisibleCountryChecked,
    resetRenderTrace: () => {
      if (!window.__datasetDetailPerfRenderTrace) {
        window.__datasetDetailPerfRenderTrace = {
          enabled: true,
          renders: {},
          profilerEvents: [],
          timings: {},
        };
        return;
      }

      window.__datasetDetailPerfRenderTrace.renders = {};
      window.__datasetDetailPerfRenderTrace.profilerEvents = [];
      window.__datasetDetailPerfRenderTrace.timings = {};
    },
    readRenderTrace: () => {
      const trace = window.__datasetDetailPerfRenderTrace;

      return {
        renders: trace?.renders ?? {},
        profilerEvents: trace?.profilerEvents ?? [],
        timings: trace?.timings ?? {},
      };
    },
    resetSortTrace: () => {
      if (!window.__datasetDetailPerfSortTrace) {
        window.__datasetDetailPerfSortTrace = {
          enabled: true,
          columns: {},
        };
        return;
      }

      window.__datasetDetailPerfSortTrace.columns = {};
    },
    readSortTrace: () => ({
      columns: window.__datasetDetailPerfSortTrace?.columns ?? {},
    }),
  };

  try {
    const observer = new PerformanceObserver((list) => {
      const tasks = window.__datasetDetailPerfLongTasks ?? [];

      for (const entry of list.getEntries()) {
        tasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }

      window.__datasetDetailPerfLongTasks = tasks;
    });

    observer.observe({ type: "longtask", buffered: true });
  } catch {
    window.__datasetDetailPerfLongTasks = [];
  }
})();
`;

export function parseProfileDatasetDetailArgs(argv: string[]): ProfileDatasetDetailArgs {
  const getArgValue = (name: string) => {
    const index = argv.indexOf(name);
    return index === -1 ? null : (argv[index + 1] ?? null);
  };

  return {
    baseUrl: getArgValue("--base-url") ?? DEFAULT_BASE_URL,
    datasetId: getArgValue("--dataset-id") ?? DEFAULT_DATASET_ID,
    email:
      getArgValue("--email") ??
      process.env.DATASET_PERF_EMAIL ??
      process.env.PERF_AUTH_EMAIL ??
      null,
    password:
      getArgValue("--password") ??
      process.env.DATASET_PERF_PASSWORD ??
      process.env.PERF_AUTH_PASSWORD ??
      null,
    headed: argv.includes("--headed"),
    keepServer: argv.includes("--keep-server"),
    skipBuild: argv.includes("--skip-build"),
    reportSuffix: getArgValue("--report-suffix"),
  };
}

export function buildProfileEnvironment(input: ProfileEnvironmentInput) {
  const environment: NodeJS.ProcessEnv = {
    ...input.processEnv,
    ...input.fileEnv,
  };

  if (!environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  delete environment.UI_SMOKE_ENABLED;
  delete environment.UI_SMOKE_BASE_URL;

  return environment;
}

function getRequiredEnvValue(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for dataset detail profiling.`);
  }

  return value;
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

async function waitForBaseUrl(baseUrl: string, timeoutMs = DEFAULT_SERVER_START_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the local server is ready.
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function assertBaseUrlAvailableForLaunch(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    throw new Error(
      `${baseUrl} is already responding with HTTP ${response.status}. Stop the existing server or use --base-url to profile on a different port.`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("already responding")) {
      throw error;
    }
  }
}

function startNextServer(input: {
  baseUrl: string;
  env: NodeJS.ProcessEnv;
}) {
  const url = new URL(input.baseUrl);
  const host = url.hostname;
  const port = url.port || "80";
  const child = spawn("pnpm", ["exec", "next", "start", "--hostname", host, "--port", port], {
    cwd: process.cwd(),
    env: input.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return { child } satisfies ServerHandle;
}

async function stopNextServer(server: ServerHandle | null) {
  if (!server || server.child.killed) {
    return;
  }

  const child = server.child;

  child.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 5_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function createSignedInStorageState(input: {
  baseUrl: string;
  email: string;
  password: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const browser = await chromium.launch({ headless: !input.headed });
  const page = await browser.newPage();

  try {
    await page.goto(input.baseUrl);
    await expect(page.locator('[data-smoke-page="home-sign-in"]')).toBeVisible();
    await expect(page.locator('[data-smoke-page-ready="home-sign-in"]')).toBeVisible();

    await page.getByLabel("Email").fill(input.email);
    await page.getByLabel("Password").fill(input.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    try {
      await page.waitForURL((url) => url.pathname === "/dashboard", {
        timeout: 30_000,
      });
    } catch (error) {
      const alertText = await page
        .locator('[role="alert"]')
        .textContent()
        .catch(() => null);

      throw new Error(
        [
          "Browser sign-in did not reach /dashboard.",
          alertText ? `Auth alert: ${alertText.trim()}` : null,
          error instanceof Error ? error.message : String(error),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    await expect(page.locator('[data-smoke-page="dashboard"]')).toBeVisible();
    await page.context().storageState({ path: input.storageStatePath });
  } finally {
    await browser.close();
  }
}

function attachRequestTracker(context: BrowserContext, datasetId: string): RequestTracker {
  const requests: TrackedRequest[] = [];
  const trackedRequests = new Map<PlaywrightRequest, TrackedRequest>();
  const rowRequestPath = `/api/datasets/${datasetId}/rows`;
  let inFlightRowRequests = 0;
  let lastRowActivityAt = Date.now();

  const handleRequest = (request: PlaywrightRequest) => {
    const trackedRequest: TrackedRequest = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startedAt: Date.now(),
      finishedAt: null,
      status: null,
      failed: false,
      isRowRequest: request.url().includes(rowRequestPath),
    };

    requests.push(trackedRequest);
    trackedRequests.set(request, trackedRequest);

    if (trackedRequest.isRowRequest) {
      inFlightRowRequests += 1;
      lastRowActivityAt = Date.now();
    }
  };

  const settleRequest = async (request: PlaywrightRequest, failed: boolean) => {
    const trackedRequest = trackedRequests.get(request);

    if (!trackedRequest) {
      return;
    }

    trackedRequest.finishedAt = Date.now();
    trackedRequest.failed = failed;

    if (!failed) {
      const response = await request.response().catch(() => null);
      trackedRequest.status = response?.status() ?? null;
    }

    trackedRequests.delete(request);

    if (trackedRequest.isRowRequest) {
      inFlightRowRequests = Math.max(0, inFlightRowRequests - 1);
      lastRowActivityAt = Date.now();
    }
  };

  const onRequest = (request: PlaywrightRequest) => {
    handleRequest(request);
  };
  const onRequestFinished = (request: PlaywrightRequest) => {
    void settleRequest(request, false);
  };
  const onRequestFailed = (request: PlaywrightRequest) => {
    void settleRequest(request, true);
  };

  context.on("request", onRequest);
  context.on("requestfinished", onRequestFinished);
  context.on("requestfailed", onRequestFailed);

  return {
    requests,
    get inFlightRowRequests() {
      return inFlightRowRequests;
    },
    get lastRowActivityAt() {
      return lastRowActivityAt;
    },
    dispose() {
      context.off("request", onRequest);
      context.off("requestfinished", onRequestFinished);
      context.off("requestfailed", onRequestFailed);
    },
  };
}

async function installLongTaskObserver(context: BrowserContext) {
  await context.addInitScript({ content: PERF_PAGE_INIT_SCRIPT });
}

async function waitForWarmDatasetState(page: Page, tracker: RequestTracker) {
  await expect(page.locator('[data-smoke-page="dataset-detail"]')).toBeVisible();
  await expect(page.locator('[data-smoke-page-ready="dataset-detail"]')).toBeVisible();
  await page.waitForFunction(() => {
    const count = document.querySelector("[data-smoke-filtered-table-count]")?.textContent?.trim();
    return Boolean(count && count !== "...");
  }, undefined, { timeout: DEFAULT_PROFILING_TIMEOUT_MS });

  const startedAt = Date.now();

  while (Date.now() - startedAt < DEFAULT_PROFILING_TIMEOUT_MS) {
    if (
      tracker.inFlightRowRequests === 0 &&
      Date.now() - tracker.lastRowActivityAt >= DEFAULT_QUIET_WINDOW_MS
    ) {
      return;
    }

    await delay(100);
  }

  throw new Error("Timed out waiting for dataset row requests to go idle.");
}

async function readTableSnapshot(page: Page): Promise<TableSnapshot> {
  return page.evaluate("window.__datasetDetailPerfHelpers.readTableSnapshot()");
}

async function readCountryOptionsSnapshot(page: Page): Promise<CountryOptionsSnapshot> {
  return page.evaluate("window.__datasetDetailPerfHelpers.readCountryOptionsSnapshot()");
}

async function resetRenderTrace(page: Page) {
  await page.evaluate("window.__datasetDetailPerfHelpers.resetRenderTrace()");
}

async function readRenderTrace(page: Page): Promise<RawRenderTraceSnapshot> {
  return page.evaluate("window.__datasetDetailPerfHelpers.readRenderTrace()");
}

async function resetSortTrace(page: Page) {
  await page.evaluate("window.__datasetDetailPerfHelpers.resetSortTrace()");
}

async function readSortTrace(page: Page): Promise<RawSortTraceSnapshot> {
  return page.evaluate("window.__datasetDetailPerfHelpers.readSortTrace()");
}

async function getLongTasksSince(page: Page, startIndex: number): Promise<LongTaskRecord[]> {
  return page.evaluate(`(window.__datasetDetailPerfLongTasks ?? []).slice(${startIndex})`);
}

async function getLongTaskIndex(page: Page) {
  return Number(await page.evaluate("(window.__datasetDetailPerfLongTasks ?? []).length"));
}

function summarizeRenderTrace(trace: RawRenderTraceSnapshot): RenderTraceSummary {
  const components = Object.entries(trace.renders)
    .map(([name, bucket]) => ({
      name,
      count: bucket.count,
      distinctKeys: Object.keys(bucket.keys).length,
      topKeys: Object.entries(bucket.keys)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([key, count]) => ({ key, count })),
    }))
    .sort((left, right) => right.count - left.count);

  const profilerById = new Map<
    string,
    {
      id: string;
      count: number;
      totalActualDuration: number;
      maxActualDuration: number;
      totalBaseDuration: number;
    }
  >();

  for (const event of trace.profilerEvents) {
    const aggregate = profilerById.get(event.id) ?? {
      id: event.id,
      count: 0,
      totalActualDuration: 0,
      maxActualDuration: 0,
      totalBaseDuration: 0,
    };

    aggregate.count += 1;
    aggregate.totalActualDuration += event.actualDuration;
    aggregate.maxActualDuration = Math.max(aggregate.maxActualDuration, event.actualDuration);
    aggregate.totalBaseDuration += event.baseDuration;
    profilerById.set(event.id, aggregate);
  }

  const profilers = Array.from(profilerById.values()).sort(
    (left, right) => right.totalActualDuration - left.totalActualDuration,
  );
  const timings = Object.entries(trace.timings)
    .map(([name, bucket]) => ({
      name,
      count: bucket.count,
      totalDurationMs: Number(bucket.totalDurationMs.toFixed(3)),
      maxDurationMs: Number(bucket.maxDurationMs.toFixed(3)),
      averageDurationMs: Number((bucket.totalDurationMs / bucket.count).toFixed(6)),
    }))
    .sort((left, right) => right.totalDurationMs - left.totalDurationMs);

  return {
    components,
    profilers,
    timings,
  };
}

export function summarizeSortTrace(trace: RawSortTraceSnapshot): SortTraceSummary {
  return Object.entries(trace.columns)
    .map(([columnId, bucket]) => ({
      columnId,
      modeDetectionCount: bucket.modeDetectionCount,
      modeDetectionDurationMs: Number(bucket.modeDetectionDurationMs.toFixed(3)),
      detectedTextCount: bucket.detectedTextCount,
      detectedAlphanumericCount: bucket.detectedAlphanumericCount,
      compareCount: bucket.compareCount,
      compareDurationMs: Number(bucket.compareDurationMs.toFixed(3)),
      textCompareCount: bucket.textCompareCount,
      textCompareDurationMs: Number(bucket.textCompareDurationMs.toFixed(3)),
      alphanumericCompareCount: bucket.alphanumericCompareCount,
      alphanumericCompareDurationMs: Number(
        bucket.alphanumericCompareDurationMs.toFixed(3),
      ),
      keyBuildCount: bucket.keyBuildCount,
      keyBuildDurationMs: Number(bucket.keyBuildDurationMs.toFixed(3)),
      tokenBuildCount: bucket.tokenBuildCount,
      tokenBuildDurationMs: Number(bucket.tokenBuildDurationMs.toFixed(3)),
    }))
    .sort((left, right) => right.compareDurationMs - left.compareDurationMs);
}

async function ensureFilterSectionExpanded(page: Page, label: string) {
  const button = page.getByRole("button", { name: `${label} filters` });
  const expanded = await button.getAttribute("aria-expanded");

  if (expanded !== "true") {
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
  }
}

async function measureInteraction(
  page: Page,
  tracker: RequestTracker,
  name: InteractionReport["name"],
  beforeSnapshot: TableSnapshot | null,
  before: string,
  action: () => Promise<void>,
  waitForUpdate: () => Promise<void>,
): Promise<InteractionReport> {
  const requestStartIndex = tracker.requests.length;
  const longTaskStartIndex = await getLongTaskIndex(page);
  await resetRenderTrace(page);
  await resetSortTrace(page);
  const startedAt = Date.now();

  await action();
  await waitForUpdate();

  const durationMs = Date.now() - startedAt;
  const afterSnapshot = await readTableSnapshot(page);
  const longTasks = await getLongTasksSince(page, longTaskStartIndex);
  const requests = tracker.requests.slice(requestStartIndex);
  const renderTrace = summarizeRenderTrace(await readRenderTrace(page));
  const sortTrace = summarizeSortTrace(await readSortTrace(page));
  const visibleRowOverlapCount = beforeSnapshot
    ? beforeSnapshot.visibleRowIds.filter((rowId) =>
        afterSnapshot.visibleRowIds.includes(rowId),
      ).length
    : 0;

  return {
    name,
    durationMs,
    rowRequestCount: requests.filter((request) => request.isRowRequest).length,
    totalRequestCount: requests.length,
    networkRequests: requests.map((request) => ({
      url: request.url,
      method: request.method,
      resourceType: request.resourceType,
      status: request.status,
      failed: request.failed,
    })),
    longTaskCount: longTasks.length,
    maxLongTaskMs: Math.max(0, ...longTasks.map((task) => task.duration)),
    mountedBodyRows: afterSnapshot.mountedBodyRows,
    mountedBodyCells: afterSnapshot.mountedBodyCells,
    headerCellCount: afterSnapshot.headerCellCount,
    visibleRowOverlapCount,
    before,
    after:
      name === "warm-country-search"
        ? (await readCountryOptionsSnapshot(page)).visibleOptionsSignature
        : afterSnapshot.firstRowsSignature,
    renderTrace,
    sortTrace,
  };
}

async function createDatasetPageContext(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const browser = await chromium.launch({ headless: !input.headed });
  const context = await browser.newContext({
    storageState: input.storageStatePath,
  });
  const tracker = attachRequestTracker(context, input.datasetId);

  await installLongTaskObserver(context);

  const page = await context.newPage();
  const datasetUrl = new URL(`/dashboard/datasets/${input.datasetId}`, input.baseUrl);
  datasetUrl.searchParams.set("source", "dashboard");
  await page.goto(datasetUrl.toString());
  await waitForWarmDatasetState(page, tracker);

  return {
    browser,
    context,
    page,
    tracker,
  };
}

async function captureRouteProof(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  screenshotPath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    const snapshot = await readTableSnapshot(session.page);
    await session.page.screenshot({ path: input.screenshotPath, fullPage: true });

    return {
      url: session.page.url(),
      filteredCount: snapshot.filteredCount,
      mountedBodyRows: snapshot.mountedBodyRows,
      mountedBodyCells: snapshot.mountedBodyCells,
      headerCellCount: snapshot.headerCellCount,
    };
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

async function profileWarmSort(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    const before = await readTableSnapshot(session.page);
    const headerButton = session.page.getByRole("button", {
      name: "People Group Name (Main)",
      exact: true,
    });

    return await measureInteraction(
      session.page,
      session.tracker,
      "warm-sort-desc",
      before,
      before.firstRowsSignature,
      async () => {
        await headerButton.click();
        await session.page.getByRole("menuitem", { name: "Desc" }).click();
      },
      async () => {
        await session.page.waitForFunction(
          (previousSignature) =>
            window.__datasetDetailPerfHelpers?.readTableSignature() !== previousSignature,
          before.firstRowsSignature,
          { timeout: DEFAULT_PROFILING_TIMEOUT_MS },
        );
      },
    );
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

async function profileWarmWatchlist(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    await ensureFilterSectionExpanded(session.page, "Watchlist");
    const before = await readTableSnapshot(session.page);
    const toggle = session.page.getByRole("switch", {
      name: "Toggle Watchlist",
      exact: true,
    });

    return await measureInteraction(
      session.page,
      session.tracker,
      "warm-watchlist-enable",
      before,
      before.filteredCount ?? before.firstRowsSignature,
      async () => {
        await toggle.click();
      },
      async () => {
        await expect(toggle).toHaveAttribute("aria-checked", "true");
        await session.page.waitForFunction(
          ({ previousCount, previousSignature }) => {
            const snapshot = window.__datasetDetailPerfHelpers?.readTableSnapshot();
            return (
              snapshot?.filteredCount !== previousCount ||
              snapshot?.firstRowsSignature !== previousSignature
            );
          },
          {
            previousCount: before.filteredCount ?? "",
            previousSignature: before.firstRowsSignature,
          },
          { timeout: DEFAULT_PROFILING_TIMEOUT_MS },
        );
      },
    );
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

async function profileWarmRegionToggle(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    await ensureFilterSectionExpanded(session.page, "Region");
    const before = await readTableSnapshot(session.page);
    const toggle = session.page.getByRole("switch", {
      name: "Toggle Asia, South",
      exact: true,
    });

    return await measureInteraction(
      session.page,
      session.tracker,
      "warm-region-toggle",
      before,
      before.filteredCount ?? before.firstRowsSignature,
      async () => {
        await toggle.click();
      },
      async () => {
        await expect(toggle).toHaveAttribute("aria-checked", "true");
        await session.page.waitForFunction(
          ({ previousCount, previousSignature }) => {
            const snapshot = window.__datasetDetailPerfHelpers?.readTableSnapshot();
            return (
              snapshot?.filteredCount !== previousCount ||
              snapshot?.firstRowsSignature !== previousSignature
            );
          },
          {
            previousCount: before.filteredCount ?? "",
            previousSignature: before.firstRowsSignature,
          },
          { timeout: DEFAULT_PROFILING_TIMEOUT_MS },
        );
      },
    );
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

async function profileWarmCountrySearch(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    await ensureFilterSectionExpanded(session.page, "Country");
    const inputField = session.page.locator('input[aria-label="Search countries"]:visible').first();
    const before = await readCountryOptionsSnapshot(session.page);

    return await measureInteraction(
      session.page,
      session.tracker,
      "warm-country-search",
      null,
      before.visibleOptionsSignature,
      async () => {
        await inputField.fill("india");
      },
      async () => {
        await session.page.waitForFunction(
          (previousSignature) =>
            window.__datasetDetailPerfHelpers?.readCountryOptionsSnapshot().visibleOptionsSignature !==
            previousSignature,
          before.visibleOptionsSignature,
          { timeout: DEFAULT_PROFILING_TIMEOUT_MS },
        );
      },
    );
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

async function profileWarmCountryToggle(input: {
  baseUrl: string;
  datasetId: string;
  storageStatePath: string;
  headed: boolean;
}) {
  const session = await createDatasetPageContext(input);

  try {
    await ensureFilterSectionExpanded(session.page, "Country");
    const inputField = session.page.locator('input[aria-label="Search countries"]:visible').first();
    await inputField.fill("india");
    await session.page.waitForFunction(() => {
      const snapshot = window.__datasetDetailPerfHelpers?.readCountryOptionsSnapshot();
      return (
        (snapshot?.visibleOptionCount ?? 0) > 0 &&
        snapshot?.visibleOptionsSignature.toLowerCase().includes("india")
      );
    });

    const before = await readTableSnapshot(session.page);
    const beforeChecked = await session.page.evaluate(
      () => window.__datasetDetailPerfHelpers?.isVisibleCountryChecked("India") ?? false,
    );
    return await measureInteraction(
      session.page,
      session.tracker,
      "warm-country-toggle",
      before,
      before.filteredCount ?? before.firstRowsSignature,
      async () => {
        const toggled = await session.page.evaluate(
          (countryName) => window.__datasetDetailPerfHelpers?.toggleVisibleCountry(countryName),
          "India",
        );

        if (!toggled) {
          throw new Error("The visible Country panel did not expose an Include India option.");
        }
      },
      async () => {
        await session.page.waitForFunction(
          ({ previousCount, previousSignature, previousChecked }) => {
            const snapshot = window.__datasetDetailPerfHelpers?.readTableSnapshot();
            const checked =
              window.__datasetDetailPerfHelpers?.isVisibleCountryChecked("India") ?? false;

            return (
              checked !== previousChecked &&
              (
                snapshot?.filteredCount !== previousCount ||
                snapshot?.firstRowsSignature !== previousSignature
              )
            );
          },
          {
            previousCount: before.filteredCount ?? "",
            previousSignature: before.firstRowsSignature,
            previousChecked: beforeChecked,
          },
          { timeout: DEFAULT_PROFILING_TIMEOUT_MS },
        );
      },
    );
  } finally {
    session.tracker.dispose();
    await session.context.close();
    await session.browser.close();
  }
}

export async function runProfileDatasetDetail() {
  const args = parseProfileDatasetDetailArgs(process.argv.slice(2));
  const artifactPaths = buildPerfArtifactPaths(args.reportSuffix);
  const fileEnv = await loadEnvironmentFile(path.join(process.cwd(), ".env.local")).catch(
    () => ({}),
  );
  const environment = buildProfileEnvironment({
    processEnv: process.env,
    fileEnv,
  });
  const email = args.email?.trim();
  const password = args.password?.trim();
  const supabaseUrl = getRequiredEnvValue(environment, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = getRequiredEnvValue(
    environment,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  if (!email || !password) {
    throw new Error(
      "Provide DATASET_PERF_EMAIL and DATASET_PERF_PASSWORD (or --email/--password) before profiling.",
    );
  }

  await mkdir(PERF_TMP_DIR, { recursive: true });
  await mkdir(PERF_OUTPUT_DIR, { recursive: true });

  console.log(`Profiling dataset detail against ${supabaseUrl}`);

  if (!args.skipBuild) {
    await runCommand("pnpm", ["exec", "next", "build"], {
      env: environment,
      timeoutMs: DEFAULT_BUILD_TIMEOUT_MS,
    });
  }

  let server: ServerHandle | null = null;

  try {
    await assertBaseUrlAvailableForLaunch(args.baseUrl);

    server = startNextServer({
      baseUrl: args.baseUrl,
      env: {
        ...environment,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
    });

    await waitForBaseUrl(args.baseUrl);
    await createSignedInStorageState({
      baseUrl: args.baseUrl,
      email,
      password,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    const routeProof = await captureRouteProof({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      screenshotPath: artifactPaths.screenshotPath,
      headed: args.headed,
    });

    console.log("Measuring warm-sort-desc");
    const warmSort = await profileWarmSort({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    console.log("Measuring warm-watchlist-enable");
    const warmWatchlist = await profileWarmWatchlist({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    console.log("Measuring warm-region-toggle");
    const warmRegion = await profileWarmRegionToggle({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    console.log("Measuring warm-country-search");
    const warmCountrySearch = await profileWarmCountrySearch({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    console.log("Measuring warm-country-toggle");
    const warmCountryToggle = await profileWarmCountryToggle({
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      storageStatePath: PERF_STORAGE_STATE_PATH,
      headed: args.headed,
    });

    const interactions = [
      warmSort,
      warmWatchlist,
      warmRegion,
      warmCountrySearch,
      warmCountryToggle,
    ];

    const report: ProfileDatasetDetailReport = {
      generatedAt: new Date().toISOString(),
      baseUrl: args.baseUrl,
      datasetId: args.datasetId,
      supabaseUrl,
      authenticatedEmail: email,
      routeProof: {
        ...routeProof,
        storageStatePath: PERF_STORAGE_STATE_PATH,
        screenshotPath: artifactPaths.screenshotPath,
      },
      interactions,
    };

    await writeFile(artifactPaths.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (!args.keepServer) {
      await stopNextServer(server);
    }
  }
}

if (isMainModule(import.meta.url)) {
  void runProfileDatasetDetail().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
