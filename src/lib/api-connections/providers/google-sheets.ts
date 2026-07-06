import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { apiConnectionOAuthCredentials } from "@/db/schema";
import type { GoogleSheetsConnectionProviderConfig } from "@/lib/api-types";
import type { CurrentIdentity } from "@/lib/auth";
import {
  GOOGLE_SHEETS_PROVIDER,
  GOOGLE_SHEETS_READONLY_SCOPE,
  assertGoogleSheetsImportSize,
  fetchGoogleSheetsTabValues,
  parseGoogleSheetsValuesToRows,
  refreshGoogleSheetsAccessToken,
  type GoogleSheetsOAuthSecret,
} from "@/lib/google-sheets";

import {
  ApiConnectionError,
  normalizeApiConnectionProviderConfig,
  serializeRowsToCsv,
} from "../core";
import type { ApiConnectionRecord, ConnectionProvider } from "../provider";
import {
  createNamedVaultSecret,
  getGoogleSheetsCredentialSecretName,
  readVaultSecretText,
} from "../vault";

type ApiConnectionOAuthCredentialRecord =
  typeof apiConnectionOAuthCredentials.$inferSelect;

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

export async function createGoogleSheetsOAuthCredential(input: {
  identity: CurrentIdentity;
  secret: GoogleSheetsOAuthSecret;
}) {
  const credentialId = randomUUID();
  const secretVaultId = await createNamedVaultSecret({
    secret: JSON.stringify(input.secret),
    name: getGoogleSheetsCredentialSecretName(credentialId),
    description: "Google Sheets OAuth refresh token",
  });

  if (!secretVaultId) {
    throw new ApiConnectionError("Could not store Google Sheets credential.", 500);
  }

  const [credential] = await getDb()
    .insert(apiConnectionOAuthCredentials)
    .values({
      id: credentialId,
      provider: GOOGLE_SHEETS_PROVIDER,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
      scopes: [GOOGLE_SHEETS_READONLY_SCOPE],
      secretVaultId,
    })
    .returning();

  return credential;
}

async function readGoogleSheetsOAuthSecret(
  credential: ApiConnectionOAuthCredentialRecord,
) {
  const rawSecret = await readVaultSecretText(credential.secretVaultId);

  if (!rawSecret) {
    throw new ApiConnectionError("Google Sheets credential was not found.", 400);
  }

  try {
    const parsed = JSON.parse(rawSecret) as Partial<GoogleSheetsOAuthSecret>;

    if (!parsed.refreshToken) {
      throw new Error("Missing refresh token.");
    }

    return {
      refreshToken: parsed.refreshToken,
      scope: parsed.scope ?? GOOGLE_SHEETS_READONLY_SCOPE,
      tokenType: parsed.tokenType ?? "Bearer",
    } satisfies GoogleSheetsOAuthSecret;
  } catch {
    throw new ApiConnectionError("Google Sheets credential is invalid.", 400);
  }
}

async function getGoogleSheetsOAuthCredential(credentialId: string | null) {
  if (!credentialId) {
    throw new ApiConnectionError("Google Sheets credential is missing.", 400);
  }

  const [credential] = await getDb()
    .select()
    .from(apiConnectionOAuthCredentials)
    .where(eq(apiConnectionOAuthCredentials.id, credentialId))
    .limit(1);

  if (!credential || credential.revokedAt) {
    throw new ApiConnectionError("Google Sheets credential is unavailable.", 400);
  }

  return credential;
}

async function fetchGoogleSheetsConnectionOutput(input: {
  connection: ApiConnectionRecord;
  secrets: Map<string, string>;
}) {
  const providerConfig = getGoogleSheetsProviderConfig(input.connection);

  if (!providerConfig) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }

  const credential = await getGoogleSheetsOAuthCredential(input.connection.oauthCredentialId);
  const secret = await readGoogleSheetsOAuthSecret(credential);
  input.secrets.set("google_refresh_token", secret.refreshToken);
  const accessToken = await refreshGoogleSheetsAccessToken(secret.refreshToken);
  input.secrets.set("google_access_token", accessToken);
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
  fetch: async ({ connection, secrets, log }) => {
    await log("Fetching Google Sheets tab.");
    return fetchGoogleSheetsConnectionOutput({ connection, secrets });
  },
  parse: () => {
    throw new ApiConnectionError(
      "Google Sheets output is parsed during fetch.",
      500,
    );
  },
};
