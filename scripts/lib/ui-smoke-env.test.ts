import { describe, expect, it } from "vitest";

import {
  buildUiSmokeCommandEnv,
  hasUsableSupabaseStatusOutput,
  parseSupabaseEnvOutput,
} from "./ui-smoke-env";

describe("ui-smoke-env", () => {
  it("parses quoted Supabase status env lines", () => {
    const parsed = parseSupabaseEnvOutput(`
API_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="sb_publishable_test"
SECRET_KEY="sb_secret_test"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    `);

    expect(parsed).toMatchObject({
      API_URL: "http://127.0.0.1:54321",
      PUBLISHABLE_KEY: "sb_publishable_test",
      SECRET_KEY: "sb_secret_test",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    });
  });

  it("builds smoke command env from Supabase status output", () => {
    const env = buildUiSmokeCommandEnv(
      parseSupabaseEnvOutput(`
API_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="sb_publishable_test"
SECRET_KEY="sb_secret_test"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      `),
    );

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test");
    expect(env.SUPABASE_SECRET_KEY).toBe("sb_secret_test");
    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
  });

  it("detects whether Supabase status output is usable", () => {
    expect(
      hasUsableSupabaseStatusOutput(`
API_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="sb_publishable_test"
SECRET_KEY="sb_secret_test"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      `),
    ).toBe(true);

    expect(
      hasUsableSupabaseStatusOutput(`
API_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="sb_publishable_test"
      `),
    ).toBe(false);
  });
});
