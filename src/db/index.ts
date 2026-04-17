import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

function createDbState() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  return {
    sql,
    db: drizzle(sql, { schema }),
  };
}

let dbState: ReturnType<typeof createDbState> | null = null;

export function getDb() {
  dbState ??= createDbState();
  return dbState.db;
}

export async function closeDb() {
  if (!dbState) {
    return;
  }

  const { sql } = dbState;
  dbState = null;
  await sql.end({ timeout: 5 });
}

export function resetDbForTests() {
  dbState = null;
}
