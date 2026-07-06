import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import Papa from "papaparse";

import type {
  ApiConnection,
  ApiConnectionHeader,
  ApiConnectionProviderConfig,
  ApiConnectionResponseFormat,
  CsvColumn,
} from "@/lib/api-types";
import { escapeCsvCell, normalizeHeaders } from "@/lib/csv";
import {
  ETNOPEDIA_CSV_COLUMNS,
  etnopediaRecordsToRows,
  isEtnopediaApiUrl,
} from "@/lib/etnopedia-api";
import type { EtnopediaRecord } from "@/lib/etnopedia-api";
import { GOOGLE_SHEETS_PROVIDER } from "@/lib/google-sheets";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_LENGTH = 8 * 1024;
export const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
export const JOSHUA_PROJECT_API_KEY_NAME = "api_key";
const JOSHUA_PROJECT_API_HOST = "api.joshuaproject.net";
const JOSHUA_PROJECT_PEOPLE_GROUPS_PATH = "/v1/people_groups.json";
export const HTTP_API_PROVIDER_CONFIG: ApiConnectionProviderConfig = {
  provider: "http_api",
};

export type ParsedApiRows = {
  rows: Record<string, string>[];
  columns: CsvColumn[];
};

export type ApiConnectionRunRequestInput = {
  method: ApiConnection["method"];
  url: string;
  requestHeaders: ApiConnectionHeader[];
  bodyTemplate: string;
  secrets: Map<string, string>;
};

export class ApiConnectionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiConnectionError";
    this.status = status;
  }
}

export function normalizeApiConnectionProviderConfig(
  value: ApiConnectionProviderConfig,
  provider: ApiConnection["provider"] = "http_api",
): ApiConnectionProviderConfig {
  if (provider === GOOGLE_SHEETS_PROVIDER && value?.provider === GOOGLE_SHEETS_PROVIDER) {
    return value;
  }

  return HTTP_API_PROVIDER_CONFIG;
}

function isBlockedIpAddress(address: string) {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split(".").map((octet) => Number.parseInt(octet, 10));
    const [first = 0, second = 0] = octets;

    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

export async function assertSafeApiUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new ApiConnectionError("API connection URLs must use HTTPS.");
  }

  if (!url.hostname) {
    throw new ApiConnectionError("API connection URL is invalid.");
  }

  if (url.username || url.password) {
    throw new ApiConnectionError("API connection URLs cannot include credentials.");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });

  if (
    addresses.length === 0 ||
    addresses.some((address) => isBlockedIpAddress(address.address))
  ) {
    throw new ApiConnectionError("API connection URL resolves to a blocked network.");
  }
}

export function redactSecrets(value: string, secrets: Map<string, string>) {
  let redacted = value;

  for (const secret of secrets.values()) {
    if (!secret) {
      continue;
    }

    redacted = redacted.split(secret).join("[redacted]");
  }

  return redacted;
}

export function previewResponse(value: string, secrets: Map<string, string>) {
  return redactSecrets(value.slice(0, MAX_PREVIEW_LENGTH), secrets);
}

export function isJoshuaProjectPeopleGroupsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === JOSHUA_PROJECT_API_HOST &&
      url.pathname === JOSHUA_PROJECT_PEOPLE_GROUPS_PATH
    );
  } catch {
    return false;
  }
}

function getCaseInsensitiveSecret(secrets: Map<string, string>, name: string) {
  const normalizedName = name.toLowerCase();

  for (const [secretName, value] of secrets) {
    if (secretName.toLowerCase() === normalizedName) {
      return value;
    }
  }

  return null;
}

export function createApiConnectionRunRequest(input: ApiConnectionRunRequestInput) {
  const headers = new Headers();
  const requestUrl = new URL(input.url);
  const isJoshuaProjectPeopleGroups = isJoshuaProjectPeopleGroupsUrl(input.url);

  for (const header of input.requestHeaders) {
    headers.set(header.name, header.value);
  }

  for (const [name, value] of input.secrets) {
    if (
      isJoshuaProjectPeopleGroups &&
      name.toLowerCase() === JOSHUA_PROJECT_API_KEY_NAME
    ) {
      continue;
    }

    headers.set(name, value);
  }

  if (isJoshuaProjectPeopleGroups) {
    const apiKey = getCaseInsensitiveSecret(input.secrets, JOSHUA_PROJECT_API_KEY_NAME);

    if (!apiKey) {
      throw new ApiConnectionError("Joshua Project API key is required.", 400);
    }

    requestUrl.searchParams.set(JOSHUA_PROJECT_API_KEY_NAME, apiKey);
  }

  return {
    url: requestUrl.toString(),
    headers,
    body: input.method === "GET" ? undefined : input.bodyTemplate || undefined,
  };
}

export async function readLimitedResponse(
  response: Response,
  maxBytes = MAX_RESPONSE_BYTES,
) {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      throw new ApiConnectionError("API response is too large.", 502);
    }

    chunks.push(Buffer.from(value));
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchWithSafeRedirects(input: {
  url: string;
  init: RequestInit;
  redirects?: number;
}): Promise<Response> {
  await assertSafeApiUrl(input.url);
  const response = await fetch(input.url, {
    ...input.init,
    redirect: "manual",
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  ) {
    const redirectCount = input.redirects ?? 0;

    if (redirectCount >= MAX_REDIRECTS) {
      throw new ApiConnectionError("API request redirected too many times.", 502);
    }

    const nextUrl = new URL(response.headers.get("location")!, input.url).toString();
    return fetchWithSafeRedirects({
      url: nextUrl,
      init: input.init,
      redirects: redirectCount + 1,
    });
  }

  return response;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getJsonPathValue(value: unknown, path: string) {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return value;
  }

  return trimmedPath.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

function objectToRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      entryValue === null || entryValue === undefined
        ? ""
        : typeof entryValue === "object"
          ? JSON.stringify(entryValue)
          : String(entryValue),
    ]),
  );
}

function parseJoshuaProjectResources(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(
      (resource): resource is Record<string, unknown> =>
        resource !== null &&
        typeof resource === "object" &&
        !Array.isArray(resource),
    );
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter(
          (resource): resource is Record<string, unknown> =>
            resource !== null &&
            typeof resource === "object" &&
            !Array.isArray(resource),
        )
      : [];
  } catch {
    return [];
  }
}

export function apiValueToString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getJoshuaProjectItems(value: unknown) {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: unknown[] }).data;
  }

  return Array.isArray(value) ? value : [value];
}

function parseJoshuaProjectPeopleGroupsRows(value: unknown) {
  const rawRows = getJoshuaProjectItems(value).map((item) => {
    if (item === undefined) {
      throw new ApiConnectionError("Configured JSON response path was not found.", 502);
    }

    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { value: JSON.stringify(item) };
    }

    const row: Record<string, string> = {};

    for (const [key, entryValue] of Object.entries(item)) {
      if (key === "Resources") {
        const resources = parseJoshuaProjectResources(entryValue);

        resources.forEach((resource, resourceIndex) => {
          const index = String(resourceIndex + 1).padStart(2, "0");

          for (const fieldName of ["ROL3", "Category", "WebText", "URL"]) {
            row[`Resource_${index}_${fieldName}`] = apiValueToString(
              resource[fieldName],
            );
          }
        });

        row.Resources_raw = apiValueToString(entryValue);
        continue;
      }

      row[key] = apiValueToString(entryValue);
    }

    return row;
  });
  const columns = rowsToColumns(rawRows);

  return {
    rows: alignRowsToColumns({ rows: rawRows, columns }),
    columns,
  };
}

export function rowsToColumns(rows: Record<string, string>[]) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      labels.push(key);
    }
  }

  return normalizeHeaders(labels.length > 0 ? labels : ["value"]);
}

export function alignRowsToColumns(input: {
  rows: Record<string, string>[];
  columns: CsvColumn[];
}) {
  return input.rows.map((row) =>
    Object.fromEntries(input.columns.map((column) => [column.key, row[column.label] ?? ""])),
  );
}

export function parseApiResponseRows(input: {
  body: string;
  responseFormat: ApiConnectionResponseFormat;
  responseDataPath: string;
  connectionUrl?: string;
}) {
  if (input.responseFormat === "csv") {
    const parsed = Papa.parse<Record<string, string>>(input.body, {
      header: true,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors.length > 0) {
      throw new ApiConnectionError("CSV API response could not be parsed.", 502);
    }

    const rawRows = parsed.data.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
    );
    const columns = rowsToColumns(rawRows);

    return {
      rows: alignRowsToColumns({ rows: rawRows, columns }),
      columns,
    };
  }

  let json: unknown;

  try {
    json = JSON.parse(input.body);
  } catch {
    throw new ApiConnectionError("JSON API response could not be parsed.", 502);
  }

  if (input.connectionUrl && isEtnopediaApiUrl(input.connectionUrl)) {
    if (!Array.isArray(json)) {
      throw new ApiConnectionError("Etnopedia export output was not an array.", 502);
    }

    const columns = normalizeHeaders([...ETNOPEDIA_CSV_COLUMNS]);
    const rawRows = etnopediaRecordsToRows(json as EtnopediaRecord[]);

    return {
      rows: alignRowsToColumns({ rows: rawRows, columns }),
      columns,
    };
  }

  const selected = getJsonPathValue(json, input.responseDataPath);

  if (
    input.connectionUrl &&
    isJoshuaProjectPeopleGroupsUrl(input.connectionUrl)
  ) {
    return parseJoshuaProjectPeopleGroupsRows(selected);
  }

  const items = Array.isArray(selected) ? selected : [selected];

  if (items.some((item) => item === undefined)) {
    throw new ApiConnectionError("Configured JSON response path was not found.", 502);
  }

  const rawRows = items.map((item) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? objectToRecord(item as Record<string, unknown>)
      : { value: item == null ? "" : String(item) },
  );
  const columns = rowsToColumns(rawRows);

  return {
    rows: alignRowsToColumns({ rows: rawRows, columns }),
    columns,
  };
}

export function serializeRowsToCsv(input: {
  rows: Record<string, string>[];
  columns: CsvColumn[];
}) {
  const header = input.columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = input.rows
    .map((row) =>
      input.columns.map((column) => escapeCsvCell(row[column.key] ?? "")).join(","),
    )
    .join("\n");

  return body ? `${header}\n${body}\n` : `${header}\n`;
}

