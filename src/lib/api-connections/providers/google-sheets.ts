import type { GoogleSheetsConnectionProviderConfig } from "@/lib/api-types";
import {
  GOOGLE_SHEETS_PROVIDER,
  assertGoogleSheetsImportSize,
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
  const values = await fetchGoogleSheetsTabValues({
    spreadsheetId: providerConfig.spreadsheetId,
    sheetTitle: providerConfig.sheetTitle,
    accessToken,
  });
  const parsed = parseGoogleSheetsValuesToRows(values);
  const csv = serializeRowsToCsv(parsed);

  assertGoogleSheetsImportSize(csv);

  return {
    body: JSON.stringify({
      provider: GOOGLE_SHEETS_PROVIDER,
      spreadsheetId: providerConfig.spreadsheetId,
      spreadsheetTitle: providerConfig.spreadsheetTitle,
      sheetId: providerConfig.sheetId,
      sheetTitle: providerConfig.sheetTitle,
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
