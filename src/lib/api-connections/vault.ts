import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { logError } from "@/lib/error-logging";

export function getVaultSecretName(connectionId: string) {
  return `api_connection_${connectionId}_headers`;
}

export function getGoogleSheetsCredentialSecretName(credentialId: string) {
  return `api_connection_google_sheets_${credentialId}`;
}

export async function createNamedVaultSecret(input: {
  secret: string;
  name: string;
  description: string;
}) {
  const rows = (await getDb().execute(sql`
    select vault.create_secret(
      ${input.secret},
      ${input.name},
      ${input.description}
    ) as id
  `)) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

export async function createVaultSecret(connectionId: string, secretHeaders: Map<string, string>) {
  if (secretHeaders.size === 0) {
    return null;
  }

  const secret = JSON.stringify(Object.fromEntries(secretHeaders));
  return createNamedVaultSecret({
    secret,
    name: getVaultSecretName(connectionId),
    description: "API connection secret headers",
  });
}

export async function updateVaultSecret(input: {
  connectionId: string;
  vaultId: string | null;
  secretHeaders: Map<string, string>;
}) {
  if (input.secretHeaders.size === 0) {
    return null;
  }

  const secret = JSON.stringify(Object.fromEntries(input.secretHeaders));

  if (input.vaultId) {
    await getDb().execute(sql`
      select vault.update_secret(
        ${input.vaultId}::uuid,
        ${secret},
        ${getVaultSecretName(input.connectionId)},
        'API connection secret headers'
      )
    `);
    return input.vaultId;
  }

  return createVaultSecret(input.connectionId, input.secretHeaders);
}

export async function readVaultSecret(vaultId: string | null) {
  const rawSecret = await readVaultSecretText(vaultId);

  if (!rawSecret) {
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(rawSecret) as Record<string, unknown>;
    return new Map(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([name, value]) => [name, value]),
    );
  } catch (error) {
    logError("Failed to parse API connection Vault secret", error);
    return new Map<string, string>();
  }
}

export async function readVaultSecretText(vaultId: string | null) {
  if (!vaultId) {
    return null;
  }

  const rows = (await getDb().execute(sql`
    select decrypted_secret
    from vault.decrypted_secrets
    where id = ${vaultId}::uuid
    limit 1
  `)) as Array<{ decrypted_secret: string | null }>;
  return rows[0]?.decrypted_secret ?? null;
}

export async function deleteVaultSecret(vaultId: string | null) {
  if (!vaultId) {
    return;
  }

  await getDb().execute(sql`delete from vault.secrets where id = ${vaultId}::uuid`);
}

