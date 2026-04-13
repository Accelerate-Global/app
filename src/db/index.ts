import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
  return drizzle(sql, { schema });
}

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  db ??= createDb();
  return db;
}
