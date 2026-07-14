import postgres from "postgres";

import { getPostgresConnectionConfig } from "../src/lib/postgres-connection";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const connection = getPostgresConnectionConfig(databaseUrl);
  const sql = postgres(connection.databaseUrl, {
    ...connection.options,
    prepare: false,
  });

  try {
    const rows = await sql<
      { schema_name: string; table_name: string }[]
    >`
      select n.nspname as schema_name, c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname = 'public'
        and not c.relrowsecurity
      order by 1, 2
    `;

    if (rows.length === 0) {
      console.log("All public-schema tables have RLS enabled.");
      process.exitCode = 0;
    } else {
      console.error("Public-schema tables missing RLS:");
      for (const row of rows) {
        console.error(`- ${row.schema_name}.${row.table_name}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
