import postgres from "postgres";

import { getPostgresConnectionConfig } from "@/lib/postgres-connection";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";

function createAnalyticsSqlState() {
  const configuration = getPrivateDataChatConfiguration();

  if (!configuration.analyticsDatabaseUrl) {
    throw new Error("Private data chat analytics database is not configured.");
  }

  const connection = getPostgresConnectionConfig(
    configuration.analyticsDatabaseUrl,
  );
  const sql = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 15,
    prepare: false,
  });

  return { sql };
}

let analyticsSqlState: ReturnType<typeof createAnalyticsSqlState> | null = null;

export function getPrivateDataChatAnalyticsSql() {
  analyticsSqlState ??= createAnalyticsSqlState();
  return analyticsSqlState.sql;
}

export async function closePrivateDataChatAnalyticsSql() {
  if (!analyticsSqlState) {
    return;
  }

  const { sql } = analyticsSqlState;
  analyticsSqlState = null;
  await sql.end({ timeout: 5 });
}

export function resetPrivateDataChatAnalyticsSqlForTests() {
  analyticsSqlState = null;
}
