import postgres from "postgres";

import { getPostgresConnectionConfig } from "../src/lib/postgres-connection";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const connection = getPostgresConnectionConfig(databaseUrl);

  if (connection.options.ssl === false) {
    console.log("Local loopback database connection does not require TLS.");
    return;
  }

  const sql = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 1,
    prepare: false,
  });

  try {
    await sql`select 1`;
    const ssl = connection.options.ssl;
    const isCertificateVerified =
      typeof ssl === "object" &&
      ssl !== null &&
      "rejectUnauthorized" in ssl &&
      ssl.rejectUnauthorized === true;

    console.log(
      isCertificateVerified
        ? "Certificate-verified database TLS connection passed."
        : "Encrypted database TLS connection passed without a configured CA.",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
