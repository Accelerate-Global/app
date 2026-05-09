import { createHash, randomBytes } from "node:crypto";

import { MAX_CSV_BYTES, normalizeHeaders } from "@/lib/csv";
import type { CsvColumn, GoogleSheetsDraftTab } from "@/lib/api-types";

export const GOOGLE_SHEETS_PROVIDER = "google_sheets" as const;
export const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
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

export type GoogleSheetsOAuthTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  tokenType: string;
  expiresIn: number | null;
};

export type GoogleSheetsOAuthSecret = {
  refreshToken: string;
  scope: string;
  tokenType: string;
};

export type GoogleSheetsSpreadsheetMetadata = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheets: GoogleSheetsDraftTab[];
};

export type GoogleSheetsParsedRows = {
  rows: Record<string, string>[];
  columns: CsvColumn[];
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new GoogleSheetsError(`${name} is not configured.`, 500);
  }

  return value;
}

function createGoogleOAuthClientConfig() {
  return {
    clientId: getRequiredEnv("GOOGLE_SHEETS_OAUTH_CLIENT_ID"),
    clientSecret: getRequiredEnv("GOOGLE_SHEETS_OAUTH_CLIENT_SECRET"),
  };
}

export function createGoogleSheetsOAuthState() {
  const value = randomBytes(32).toString("base64url");

  return {
    value,
    hash: hashGoogleSheetsOAuthState(value),
  };
}

export function hashGoogleSheetsOAuthState(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

export function createGoogleSheetsAuthorizationUrl(input: {
  redirectUri: string;
  state: string;
}) {
  const { clientId } = createGoogleOAuthClientConfig();
  const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SHEETS_READONLY_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);

  return url.toString();
}

async function postGoogleTokenRequest(body: URLSearchParams) {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new GoogleSheetsError("Google OAuth token exchange failed.", 502);
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";
  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : null;

  if (!accessToken) {
    throw new GoogleSheetsError("Google OAuth did not return an access token.", 502);
  }

  return {
    accessToken,
    refreshToken,
    scope,
    tokenType,
    expiresIn,
  } satisfies GoogleSheetsOAuthTokenResponse;
}

export async function exchangeGoogleSheetsOAuthCode(input: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = createGoogleOAuthClientConfig();

  return postGoogleTokenRequest(
    new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

export async function refreshGoogleSheetsAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = createGoogleOAuthClientConfig();
  const token = await postGoogleTokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );

  return token.accessToken;
}

async function getGoogleJson(input: {
  url: string;
  accessToken: string;
  errorMessage: string;
}) {
  const response = await fetch(input.url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    throw new GoogleSheetsError(input.errorMessage, 502);
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
    .map((sheet): GoogleSheetsDraftTab | null => {
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
    .filter((sheet): sheet is GoogleSheetsDraftTab => sheet !== null)
    .sort((first, second) => first.index - second.index);

  if (sheets.length === 0) {
    throw new GoogleSheetsError("Google Sheet does not include any readable tabs.", 502);
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
