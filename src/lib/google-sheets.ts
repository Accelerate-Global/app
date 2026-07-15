import { createHash } from "node:crypto";

import { JWT } from "google-auth-library";

import { MAX_CSV_BYTES, normalizeHeaders } from "@/lib/csv";
import type {
  CsvColumn,
  GoogleSheetsConnectionTab,
  GoogleSheetsGridRange,
  GoogleSheetsHeaderCandidate,
  GoogleSheetsHeaderConfidence,
  GoogleSheetsHeaderConfiguration,
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderResolvedSelection,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";

export const GOOGLE_SHEETS_PROVIDER = "google_sheets" as const;
export const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const GOOGLE_SHEETS_API_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
export const GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT = 25;
const GOOGLE_SHEETS_HEADER_SAMPLE_ROW_LIMIT = 3;
const GOOGLE_SHEETS_MAX_HEADER_ROWS = 3;
const HEADER_TERM_PATTERN =
  /(?:^|\b)(?:name|country|people|group|date|status|id|source|mission|engagement|language|population|church|believer|code|note|region|organization|tracking)(?:\b|$)/iu;
const NUMERIC_GUIDE_PATTERN = /^\d+(?:\.\d+)?$/u;

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
    "properties(title),sheets(properties(sheetId,title,index,gridProperties(frozenRowCount)),merges)",
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

      const { sheetId, title, index, gridProperties } = sheet.properties;
      const frozenRowCount =
        isRecord(gridProperties) && typeof gridProperties.frozenRowCount === "number"
          ? gridProperties.frozenRowCount
          : 0;
      const merges = Array.isArray(sheet.merges)
        ? sheet.merges.flatMap((merge): GoogleSheetsGridRange[] => {
            if (!isRecord(merge)) {
              return [];
            }
            const {
              startRowIndex,
              endRowIndex,
              startColumnIndex,
              endColumnIndex,
            } = merge;
            return typeof startRowIndex === "number" &&
              typeof endRowIndex === "number" &&
              typeof startColumnIndex === "number" &&
              typeof endColumnIndex === "number"
              ? [
                  {
                    startRowIndex,
                    endRowIndex,
                    startColumnIndex,
                    endColumnIndex,
                  },
                ]
              : [];
          })
        : [];

      return typeof sheetId === "number" && typeof title === "string"
        ? {
            sheetId,
            title,
            index: typeof index === "number" ? index : 0,
            frozenRowCount,
            merges,
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
  rowLimit?: number;
}) {
  const range = input.rowLimit
    ? `${escapeSheetTitleForA1(input.sheetTitle)}!1:${input.rowLimit}`
    : escapeSheetTitleForA1(input.sheetTitle);
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

function normalizeHeaderFragment(value: unknown) {
  return valueToString(value).replace(/\s+/gu, " ").trim();
}

function getValuesWidth(values: unknown[][]) {
  return Math.max(0, ...values.map((row) => row.length));
}

function validateHeaderRange(input: {
  values: unknown[][];
  startRow: number;
  endRow: number;
}) {
  if (
    !Number.isInteger(input.startRow) ||
    !Number.isInteger(input.endRow) ||
    input.startRow < 1 ||
    input.endRow < input.startRow ||
    input.endRow - input.startRow + 1 > GOOGLE_SHEETS_MAX_HEADER_ROWS ||
    input.endRow > GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT ||
    input.endRow > input.values.length
  ) {
    throw new GoogleSheetsError(
      `Choose one to ${GOOGLE_SHEETS_MAX_HEADER_ROWS} consecutive header rows from the preview.`,
    );
  }
}

function expandMergedHeaderValues(input: {
  values: unknown[][];
  startRow: number;
  endRow: number;
  width: number;
  merges: GoogleSheetsGridRange[];
}) {
  const rows = Array.from(
    { length: input.endRow - input.startRow + 1 },
    (_, rowOffset) =>
      Array.from({ length: input.width }, (_, columnIndex) =>
        normalizeHeaderFragment(
          input.values[input.startRow - 1 + rowOffset]?.[columnIndex],
        ),
      ),
  );

  for (const merge of input.merges) {
    const source = normalizeHeaderFragment(
      input.values[merge.startRowIndex]?.[merge.startColumnIndex],
    );
    if (!source) {
      continue;
    }

    for (
      let sourceRowIndex = Math.max(merge.startRowIndex, input.startRow - 1);
      sourceRowIndex < Math.min(merge.endRowIndex, input.endRow);
      sourceRowIndex += 1
    ) {
      for (
        let columnIndex = Math.max(0, merge.startColumnIndex);
        columnIndex < Math.min(input.width, merge.endColumnIndex);
        columnIndex += 1
      ) {
        const targetRow = rows[sourceRowIndex - (input.startRow - 1)];
        if (targetRow && !targetRow[columnIndex]) {
          targetRow[columnIndex] = source;
        }
      }
    }
  }

  return rows;
}

export function composeGoogleSheetsHeader(input: {
  values: unknown[][];
  startRow: number;
  endRow: number;
  merges?: GoogleSheetsGridRange[];
}) {
  validateHeaderRange(input);
  const width = getValuesWidth(input.values);
  const rows = expandMergedHeaderValues({
    ...input,
    width,
    merges: input.merges ?? [],
  });
  const isCombined = input.endRow > input.startRow;
  const headers = Array.from({ length: width }, (_, columnIndex) => {
    const seen = new Set<string>();
    const fragments: string[] = [];

    for (const row of rows) {
      const fragment = row[columnIndex] ?? "";
      if (!fragment || (isCombined && NUMERIC_GUIDE_PATTERN.test(fragment))) {
        continue;
      }
      const normalized = fragment.toLocaleLowerCase().replace(/\s+/gu, " ");
      if (!seen.has(normalized)) {
        seen.add(normalized);
        fragments.push(fragment);
      }
    }

    return fragments.join(" / ");
  });

  if (!headers.some(Boolean)) {
    throw new GoogleSheetsError("The selected header rows do not contain labels.");
  }

  return headers;
}

export function fingerprintGoogleSheetsHeaders(headers: string[]) {
  const normalized = headers.map((header) =>
    normalizeHeaderFragment(header).toLocaleLowerCase(),
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function scoreGoogleSheetsHeaderRow(input: {
  values: unknown[][];
  rowIndex: number;
  width: number;
}) {
  const values = Array.from({ length: input.width }, (_, columnIndex) =>
    normalizeHeaderFragment(input.values[input.rowIndex]?.[columnIndex]),
  );
  const filled = values.filter(Boolean);
  if (filled.length === 0 || input.width === 0) {
    return null;
  }

  const numericCount = filled.filter((value) =>
    NUMERIC_GUIDE_PATTERN.test(value),
  ).length;
  const semanticCount = filled.filter((value) =>
    HEADER_TERM_PATTERN.test(value),
  ).length;
  const occupancy = filled.length / input.width;
  const numericRatio = numericCount / filled.length;
  const semanticRatio = semanticCount / filled.length;
  const uniqueRatio =
    new Set(filled.map((value) => value.toLocaleLowerCase())).size / filled.length;
  const averageLength =
    filled.reduce((total, value) => total + value.length, 0) / filled.length;
  const sparsePenalty = occupancy < 0.25 ? 3 : 0;
  const numericPenalty = numericRatio > 0.6 ? 4 : 0;
  const score =
    4 * occupancy +
    2 * (1 - numericRatio) +
    1.5 * uniqueRatio +
    2 * semanticRatio +
    Math.min(1, averageLength / 24) -
    sparsePenalty -
    numericPenalty;

  return { values, score };
}

function confidenceForScore(score: number): GoogleSheetsHeaderConfidence {
  if (score >= 7.5) {
    return "high";
  }
  if (score >= 5.5) {
    return "medium";
  }
  return "low";
}

function getHeaderCandidates(values: unknown[][]) {
  const boundedValues = values.slice(0, GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT);
  const width = getValuesWidth(boundedValues);
  return boundedValues.flatMap((_, rowIndex): GoogleSheetsHeaderCandidate[] => {
    const scored = scoreGoogleSheetsHeaderRow({ values: boundedValues, rowIndex, width });
    return scored
      ? [
          {
            rowNumber: rowIndex + 1,
            score: Number(scored.score.toFixed(2)),
            confidence: confidenceForScore(scored.score),
            values: scored.values,
          },
        ]
      : [];
  });
}

function chooseRecommendedCandidate(candidates: GoogleSheetsHeaderCandidate[]) {
  const ranked = [...candidates].sort(
    (first, second) => second.score - first.score || first.rowNumber - second.rowNumber,
  );
  const recommended = ranked[0];
  if (!recommended) {
    throw new GoogleSheetsError("Google Sheet tab does not include a header row.", 502);
  }
  const margin = recommended.score - (ranked[1]?.score ?? 0);
  const confidence: GoogleSheetsHeaderConfidence =
    recommended.score >= 7.5 && margin >= 1
      ? "high"
      : recommended.score >= 5.5 && margin >= 0.5
        ? "medium"
        : "low";
  return { ...recommended, confidence };
}

export function createGoogleSheetsHeaderPreview(input: {
  values: unknown[][];
  sheetId: number;
  sheetTitle: string;
  merges?: GoogleSheetsGridRange[];
  selection?: Omit<GoogleSheetsHeaderSelectionInput, "sheetId">;
}): GoogleSheetsHeaderPreview {
  const boundedValues = input.values.slice(0, GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT);
  const candidates = getHeaderCandidates(boundedValues);
  const recommended = chooseRecommendedCandidate(candidates);
  const selection = input.selection ?? {
    mode: "auto" as const,
    startRow: recommended.rowNumber,
    endRow: recommended.rowNumber,
  };
  const headers = composeGoogleSheetsHeader({
    values: boundedValues,
    startRow: selection.startRow,
    endRow: selection.endRow,
    merges: input.merges,
  });
  const selectedConfidence =
    selection.startRow === recommended.rowNumber &&
    selection.endRow === recommended.rowNumber
      ? recommended.confidence
      : (candidates.find((candidate) => candidate.rowNumber === selection.startRow)
          ?.confidence ?? "low");
  const sampleRows = boundedValues
    .slice(selection.endRow)
    .filter(rowHasValue)
    .slice(0, GOOGLE_SHEETS_HEADER_SAMPLE_ROW_LIMIT)
    .map((row) =>
      Array.from({ length: headers.length }, (_, index) =>
        valueToString(row[index]),
      ),
    );

  return {
    sheetId: input.sheetId,
    sheetTitle: input.sheetTitle,
    inspectedRowCount: boundedValues.length,
    candidates,
    recommendedRow: recommended.rowNumber,
    selected: {
      mode: selection.mode,
      startRow: selection.startRow,
      endRow: selection.endRow,
      headers,
      fingerprint: fingerprintGoogleSheetsHeaders(headers),
      confidence: selectedConfidence,
    },
    sampleRows,
  };
}

export function confirmGoogleSheetsHeaderSelection(input: {
  values: unknown[][];
  sheetId: number;
  sheetTitle: string;
  selection: GoogleSheetsHeaderSelectionInput;
  merges?: GoogleSheetsGridRange[];
  confirmedAt?: Date;
}) {
  if (input.selection.sheetId !== input.sheetId) {
    throw new GoogleSheetsError("Google Sheets header selection is invalid.");
  }
  const preview = createGoogleSheetsHeaderPreview({
    values: input.values,
    sheetId: input.sheetId,
    sheetTitle: input.sheetTitle,
    merges: input.merges,
    selection: input.selection,
  });
  if (
    input.selection.mode === "auto" &&
    (input.selection.startRow !== preview.recommendedRow ||
      input.selection.endRow !== preview.recommendedRow)
  ) {
    throw new GoogleSheetsError(
      "Automatic header selection must use the recommended row.",
    );
  }

  const configuration: GoogleSheetsHeaderConfiguration = {
    ...preview.selected,
    confirmedAt: (input.confirmedAt ?? new Date()).toISOString(),
  };
  return { preview, configuration };
}

function resolveGoogleSheetsHeader(input: {
  values: unknown[][];
  headerSelection?: GoogleSheetsHeaderConfiguration;
  merges?: GoogleSheetsGridRange[];
}) {
  if (!input.headerSelection) {
    const preview = createGoogleSheetsHeaderPreview({
      values: input.values,
      sheetId: 0,
      sheetTitle: "Google Sheet",
      merges: input.merges,
    });
    if (preview.selected.confidence !== "high") {
      throw new GoogleSheetsError(
        "Review and save the Google Sheet header row before importing.",
        409,
      );
    }
    return preview.selected;
  }

  const configured = input.headerSelection;
  const configuredHeaders = composeGoogleSheetsHeader({
    values: input.values,
    startRow: configured.startRow,
    endRow: configured.endRow,
    merges: input.merges,
  });
  if (fingerprintGoogleSheetsHeaders(configuredHeaders) === configured.fingerprint) {
    return { ...configured, headers: configuredHeaders };
  }

  const height = configured.endRow - configured.startRow + 1;
  const lastStart = Math.min(
    GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT - height + 1,
    input.values.length - height + 1,
  );
  const matches: GoogleSheetsHeaderResolvedSelection[] = [];
  for (let startRow = 1; startRow <= lastStart; startRow += 1) {
    const endRow = startRow + height - 1;
    let headers: string[];
    try {
      headers = composeGoogleSheetsHeader({
        values: input.values,
        startRow,
        endRow,
        merges: input.merges,
      });
    } catch (error) {
      if (error instanceof GoogleSheetsError) {
        continue;
      }
      throw error;
    }
    if (fingerprintGoogleSheetsHeaders(headers) === configured.fingerprint) {
      matches.push({ ...configured, startRow, endRow, headers });
    }
  }

  if (matches.length !== 1) {
    throw new GoogleSheetsError(
      "The Google Sheet header changed. Review the header selection before importing.",
      409,
    );
  }
  return matches[0]!;
}

export function parseGoogleSheetsValuesToRows(
  values: unknown[][],
  options: {
    headerSelection?: GoogleSheetsHeaderConfiguration;
    merges?: GoogleSheetsGridRange[];
  } = {},
): GoogleSheetsParsedRows {
  const resolvedHeader = resolveGoogleSheetsHeader({
    values,
    headerSelection: options.headerSelection,
    merges: options.merges,
  });
  const dataRows = values.slice(resolvedHeader.endRow).filter(rowHasValue);
  const width = Math.max(
    resolvedHeader.headers.length,
    ...dataRows.map((row) => row.length),
  );
  const header = Array.from({ length: width }, (_, index) =>
    valueToString(resolvedHeader.headers[index]),
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
