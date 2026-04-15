import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { prepare: false });

try {
  const rows = await sql`
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
      and not c.relrowsecurity
    order by 1, 2
  `;

  if (rows.length === 0) {
    console.log("All public tables have RLS enabled.");
    process.exit(0);
  }

  console.error("Public tables missing RLS:");
  for (const row of rows) {
    console.error(`- ${row.schema_name}.${row.table_name}`);
  }
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
