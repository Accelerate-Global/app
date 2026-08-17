import { createHash } from "node:crypto";

import {
  ApiConnectionError,
  REQUEST_TIMEOUT_MS,
  fetchWithSafeRedirects,
  isJoshuaProjectPeopleGroupsUrl,
  isRecord,
  parseApiResponseRows,
  readLimitedResponse,
} from "../core";
import type { ConnectionProvider } from "../provider";

export const JOSHUA_PROJECT_PAGE_SIZE = 100;
export const MAX_JOSHUA_PROJECT_PAGE_BYTES = 4 * 1024 * 1024;
export const MAX_JOSHUA_PROJECT_RESPONSE_BYTES = 192 * 1024 * 1024;
export const MAX_JOSHUA_PROJECT_PAGES = 1_000;

function getJoshuaProjectPageUrl(input: {
  url: string;
  page: number;
  pageSize: number;
}) {
  const url = new URL(input.url);
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("limit", String(input.pageSize));
  return url.toString();
}

function parseJoshuaProjectPage(body: string, page: number) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ApiConnectionError(
      `Joshua Project API returned invalid JSON on page ${page}.`,
      502,
    );
  }

  const records = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.data)
      ? parsed.data
      : null;

  if (!records) {
    throw new ApiConnectionError(
      `Joshua Project API response did not include a record array on page ${page}.`,
      502,
    );
  }

  if (records.some((record) => !isRecord(record))) {
    throw new ApiConnectionError(
      `Joshua Project API response included an invalid record on page ${page}.`,
      502,
    );
  }

  return records as Record<string, unknown>[];
}

export async function fetchJoshuaProjectPeopleGroupPage(input: {
  url: string;
  headers: Headers;
  page: number;
  pageSize?: number;
  maxPageBytes?: number;
  onHttpStatus?: (status: number) => void;
  fetchSafe?: typeof fetchWithSafeRedirects;
}) {
  const pageSize = input.pageSize ?? JOSHUA_PROJECT_PAGE_SIZE;
  const maxPageBytes = input.maxPageBytes ?? MAX_JOSHUA_PROJECT_PAGE_BYTES;

  if (input.page <= 0 || pageSize <= 0) {
    throw new ApiConnectionError(
      "Joshua Project page and page size must be greater than zero.",
    );
  }

  if (maxPageBytes <= 0) {
    throw new ApiConnectionError(
      "Joshua Project page byte limit must be greater than zero.",
    );
  }

  const pageUrl = getJoshuaProjectPageUrl({
    url: input.url,
    page: input.page,
    pageSize,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await (input.fetchSafe ?? fetchWithSafeRedirects)({
      url: pageUrl,
      init: {
        method: "GET",
        headers: input.headers,
        signal: controller.signal,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  input.onHttpStatus?.(response.status);
  const upstreamBody = await readLimitedResponse(response, maxPageBytes);

  if (!response.ok) {
    throw new ApiConnectionError(
      `Joshua Project API request failed with HTTP ${response.status} on page ${input.page}.`,
      502,
    );
  }

  const records = parseJoshuaProjectPage(upstreamBody, input.page);
  const body = JSON.stringify(records);

  return {
    body,
    records,
    recordCount: records.length,
    terminal: records.length < pageSize,
    httpStatus: response.status,
    byteLength: Buffer.byteLength(upstreamBody),
    fingerprint:
      records.length === 0
        ? null
        : createHash("sha256").update(body).digest("hex"),
  };
}

export async function fetchJoshuaProjectPeopleGroupPages(input: {
  url: string;
  headers: Headers;
  pageSize?: number;
  maxPageBytes?: number;
  maxTotalBytes?: number;
  maxPages?: number;
  log?: (message: string) => Promise<void>;
  onHttpStatus?: (status: number) => void;
  fetchSafe?: typeof fetchWithSafeRedirects;
}) {
  const pageSize = input.pageSize ?? JOSHUA_PROJECT_PAGE_SIZE;
  const maxPageBytes = input.maxPageBytes ?? MAX_JOSHUA_PROJECT_PAGE_BYTES;
  const maxTotalBytes =
    input.maxTotalBytes ?? MAX_JOSHUA_PROJECT_RESPONSE_BYTES;
  const maxPages = input.maxPages ?? MAX_JOSHUA_PROJECT_PAGES;

  if (pageSize <= 0) {
    throw new ApiConnectionError(
      "Joshua Project page size must be greater than zero.",
    );
  }

  if (maxPageBytes <= 0 || maxTotalBytes <= 0 || maxPages <= 0) {
    throw new ApiConnectionError(
      "Joshua Project pagination limits must be greater than zero.",
    );
  }

  const records: Record<string, unknown>[] = [];
  const pageFingerprints = new Set<string>();
  let page = 1;
  let totalBytes = 0;
  let httpStatus: number | null = null;

  while (true) {
    if (page > maxPages) {
      throw new ApiConnectionError(
        `Joshua Project API response exceeded ${maxPages} pages.`,
        502,
      );
    }

    const result = await fetchJoshuaProjectPeopleGroupPage({
      url: input.url,
      headers: input.headers,
      page,
      pageSize,
      maxPageBytes,
      onHttpStatus: input.onHttpStatus,
      fetchSafe: input.fetchSafe,
    });
    httpStatus = result.httpStatus;
    totalBytes += result.byteLength;

    if (totalBytes > maxTotalBytes) {
      throw new ApiConnectionError(
        "Joshua Project aggregate response is too large.",
        502,
      );
    }

    if (result.fingerprint) {
      if (pageFingerprints.has(result.fingerprint)) {
        throw new ApiConnectionError(
          `Joshua Project API repeated page ${page}.`,
          502,
        );
      }

      pageFingerprints.add(result.fingerprint);
    }

    records.push(...result.records);
    await input.log?.(
      `Fetched Joshua Project page ${page}: ${result.recordCount} ${
        result.recordCount === 1 ? "record" : "records"
      } (${records.length} total).`,
    );

    if (result.terminal) {
      break;
    }

    page += 1;
  }

  return {
    body: JSON.stringify(records),
    recordCount: records.length,
    httpStatus,
  };
}

export const joshuaProjectProvider: ConnectionProvider = {
  name: "joshua_project",
  matches: ({ requestUrl }) => isJoshuaProjectPeopleGroupsUrl(requestUrl),
  fetch: async ({ requestConfig, log, onHttpStatus }) => {
    const result = await fetchJoshuaProjectPeopleGroupPages({
      url: requestConfig.url,
      headers: requestConfig.headers,
      log,
      onHttpStatus,
    });

    return {
      body: result.body,
      httpStatus: result.httpStatus,
      parsed: null,
    };
  },
  parse: ({ body, connection }) =>
    parseApiResponseRows({
      body,
      responseFormat: connection.responseFormat,
      responseDataPath: connection.responseDataPath,
      connectionUrl: connection.url,
    }),
};
