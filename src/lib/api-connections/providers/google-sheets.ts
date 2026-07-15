import type { GoogleSheetsConnectionProviderConfig } from "@/lib/api-types";
import {
  GOOGLE_SHEETS_PROVIDER,
  assertGoogleSheetsImportSize,
  fetchGoogleSheetsSpreadsheetMetadata,
  fetchGoogleSheetsTabValues,
  getGoogleSheetsServiceAccountAccessToken,
  parseGoogleSheetsValuesToRows,
} from "@/lib/google-sheets";

import {
  ApiConnectionError,
  normalizeApiConnectionProviderConfig,
  serializeRowsToCsv,
} from "../core";
import type { ApiConnectionRecord, ConnectionProvider } from "../provider";

function getGoogleSheetsProviderConfig(
  connection: ApiConnectionRecord,
): GoogleSheetsConnectionProviderConfig | null {
  const providerConfig = normalizeApiConnectionProviderConfig(
    connection.providerConfig,
    connection.provider,
  );

  return providerConfig.provider === GOOGLE_SHEETS_PROVIDER
    ? providerConfig
    : null;
}

async function fetchGoogleSheetsConnectionOutput(input: {
  connection: ApiConnectionRecord;
}) {
  const providerConfig = getGoogleSheetsProviderConfig(input.connection);

  if (!providerConfig) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }

  const accessToken = await getGoogleSheetsServiceAccountAccessToken();
  const metadata = await fetchGoogleSheetsSpreadsheetMetadata({
    spreadsheetId: providerConfig.spreadsheetId,
    accessToken,
  });
  const selectedSheet = metadata.sheets.find(
    (sheet) => sheet.sheetId === providerConfig.sheetId,
  );
  if (!selectedSheet) {
    throw new ApiConnectionError(
      "Google Sheet tab is not readable by the service account.",
      404,
    );
  }
  const values = await fetchGoogleSheetsTabValues({
    spreadsheetId: providerConfig.spreadsheetId,
    sheetTitle: selectedSheet.title,
    accessToken,
  });
  const parsed = parseGoogleSheetsValuesToRows(values, {
    headerSelection: providerConfig.headerSelection,
    merges: selectedSheet.merges ?? [],
  });
  const csv = serializeRowsToCsv(parsed);

  assertGoogleSheetsImportSize(csv);

  return {
    body: JSON.stringify({
      provider: GOOGLE_SHEETS_PROVIDER,
      spreadsheetId: providerConfig.spreadsheetId,
      spreadsheetTitle: metadata.spreadsheetTitle,
      sheetId: providerConfig.sheetId,
      sheetTitle: selectedSheet.title,
      values,
    }),
    parsed,
    httpStatus: 200,
  };
}

export const googleSheetsProvider: ConnectionProvider = {
  name: "google_sheets",
  matches: ({ connection }) => connection.provider === GOOGLE_SHEETS_PROVIDER,
  fetch: async ({ connection, log }) => {
    await log("Fetching Google Sheets tab.");
    return fetchGoogleSheetsConnectionOutput({ connection });
  },
  parse: () => {
    throw new ApiConnectionError(
      "Google Sheets output is parsed during fetch.",
      500,
    );
  },
};
