import { JWT } from "google-auth-library";

import { MAX_CSV_BYTES, normalizeHeaders } from "@/lib/csv";
import type { CsvColumn, GoogleSheetsConnectionTab } from "@/lib/api-types";

export const GOOGLE_SHEETS_PROVIDER = "google_sheets" as const;
export const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const GOOGLE_SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GoogleSheetsError";
    this.status = status;
  }
}

export type ParsedGoogleSheetUrl = {
  spreadsheetId: string;
  gid: number | null;
  spreadsheetUrl: string;
};

export type GoogleSheetsSpreadsheetMetadata = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheets: GoogleSheetsConnectionTab[];
};

export type GoogleSheetsParsedRows = {
  rows: Record<string, string>[];
  columns: CsvColumn[];
};

export type GoogleSheetsServiceAccountConfig = {
  email: string;
  privateKey: string;
};

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new GoogleSheetsError(message, 500);
  }

  return value;
}

export function getGoogleSheetsServiceAccountEmail() {
  return getRequiredEnv(
    "GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL",
    "Google Sheets service account email is not configured.",
  );
}

export function getGoogleSheetsServiceAccountConfig(): GoogleSheetsServiceAccountConfig {
  return {
    email: getGoogleSheetsServiceAccountEmail(),
    privateKey: getRequiredEnv(
      "GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY",
      "Google Sheets service account credentials are not configured.",
    )
      .replace(/\\n/g, "\n")
      .trim(),
  };
}

export async function getGoogleSheetsServiceAccountAccessToken() {
  const config = getGoogleSheetsServiceAccountConfig();

  try {
    const client = new JWT({
      email: config.email,
      key: config.privateKey,
      scopes: [GOOGLE_SHEETS_READONLY_SCOPE],
    });
    const token = await client.getAccessToken();

    if (!token.token) {
      throw new Error("Missing Google Sheets access token.");
    }

    return token.token;
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      throw error;
    }

    throw new GoogleSheetsError(
      "Google Sheets service account credentials are invalid.",
      500,
    );
  }
}

export function parseGoogleSheetUrl(value: string): ParsedGoogleSheetUrl {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new GoogleSheetsError("Enter a valid Google Sheet URL.");
  }

  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new GoogleSheetsError("Google Sheet URLs must use https://docs.google.com.");
  }

  const match = /^\/spreadsheets\/d\/([^/]+)/u.exec(url.pathname);

  if (!match?.[1]) {
    throw new GoogleSheetsError("Google Sheet URL must include a spreadsheet ID.");
  }

  const rawGid = url.hash.match(/(?:^#|&)gid=(\d+)/u)?.[1] ?? url.searchParams.get("gid");
  const gid = rawGid ? Number.parseInt(rawGid, 10) : null;

  return {
    spreadsheetId: match[1],
    gid: Number.isFinite(gid) ? gid : null,
    spreadsheetUrl: url.toString(),
  };
}

async function getGoogleJson(input: {
  url: string;
  accessToken: string;
  errorMessage: string;
  accessErrorMessage?: string;
}) {
  const response = await fetch(input.url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const status = [401, 403, 404].includes(response.status) ? 403 : 502;

    throw new GoogleSheetsError(
      status === 403
        ? input.accessErrorMessage ?? input.errorMessage
        : input.errorMessage,
      status,
    );
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function fetchGoogleSheetsSpreadsheetMetadata(input: {
  spreadsheetId: string;
  accessToken: string;
}): Promise<GoogleSheetsSpreadsheetMetadata> {
  const url = new URL(`${GOOGLE_SHEETS_API_BASE_URL}/${input.spreadsheetId}`);

  url.searchParams.set(
    "fields",
    "properties(title),sheets(properties(sheetId,title,index))",
  );

  const payload = await getGoogleJson({
    url: url.toString(),
    accessToken: input.accessToken,
    errorMessage: "Could not load Google Sheet metadata.",
    accessErrorMessage: "Google Sheet is not shared with the service account.",
  });

  if (!isRecord(payload)) {
    throw new GoogleSheetsError("Google Sheet metadata was invalid.", 502);
  }

  const spreadsheetTitle =
    isRecord(payload.properties) && typeof payload.properties.title === "string"
      ? payload.properties.title
      : "Google Sheet";
  const rawSheets = Array.isArray(payload.sheets) ? payload.sheets : [];
  const sheets = rawSheets
    .map((sheet): GoogleSheetsConnectionTab | null => {
      if (!isRecord(sheet) || !isRecord(sheet.properties)) {
        return null;
      }

      const { sheetId, title, index } = sheet.properties;

      return typeof sheetId === "number" && typeof title === "string"
        ? {
            sheetId,
            title,
            index: typeof index === "number" ? index : 0,
          }
        : null;
    })
    .filter((sheet): sheet is GoogleSheetsConnectionTab => sheet !== null)
    .sort((first, second) => first.index - second.index);

  if (sheets.length === 0) {
    throw new GoogleSheetsError("Google Sheet does not include any readable tabs.");
  }

  return {
    spreadsheetId: input.spreadsheetId,
    spreadsheetTitle,
    sheets,
  };
}

function escapeSheetTitleForA1(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function fetchGoogleSheetsTabValues(input: {
  spreadsheetId: string;
  sheetTitle: string;
  accessToken: string;
}) {
  const range = escapeSheetTitleForA1(input.sheetTitle);
  const url = new URL(
    `${GOOGLE_SHEETS_API_BASE_URL}/${input.spreadsheetId}/values/${encodeURIComponent(range)}`,
  );

  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const payload = await getGoogleJson({
    url: url.toString(),
    accessToken: input.accessToken,
    errorMessage: "Could not load Google Sheet tab values.",
    accessErrorMessage:
      "Google Sheet tab is not readable by the service account.",
  });

  if (!isRecord(payload) || !Array.isArray(payload.values)) {
    return [];
  }

  return payload.values.map((row) => (Array.isArray(row) ? row : []));
}

function valueToString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function rowHasValue(row: unknown[]) {
  return row.some((value) => valueToString(value).trim() !== "");
}

export function parseGoogleSheetsValuesToRows(
  values: unknown[][],
): GoogleSheetsParsedRows {
  const headerIndex = values.findIndex(rowHasValue);

  if (headerIndex === -1) {
    throw new GoogleSheetsError("Google Sheet tab does not include a header row.", 502);
  }

  const dataRows = values.slice(headerIndex + 1).filter(rowHasValue);
  const width = Math.max(
    values[headerIndex]?.length ?? 0,
    ...dataRows.map((row) => row.length),
  );
  const header = Array.from({ length: width }, (_, index) =>
    valueToString(values[headerIndex]?.[index]),
  );

  if (!header.some((value) => value.trim() !== "")) {
    throw new GoogleSheetsError("Google Sheet tab does not include a header row.", 502);
  }

  const columns = normalizeHeaders(header);
  const rows = dataRows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column.key, valueToString(row[column.sourceIndex])]),
    ),
  );

  return { rows, columns };
}

export function assertGoogleSheetsImportSize(csv: string) {
  if (Buffer.byteLength(csv) > MAX_CSV_BYTES) {
    throw new GoogleSheetsError("Google Sheet import is too large.", 502);
  }
}
