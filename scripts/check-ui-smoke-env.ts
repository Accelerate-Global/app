import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { UI_SMOKE_PASSWORD } from "../tests/ui/support/smoke-data";
import {
  buildUiSmokeCommandEnv,
  getUiSmokeEnv,
  getUiSmokeStorageAdminKey,
  parseSupabaseEnvOutput,
} from "./lib/ui-smoke-env";
import { runCommand } from "./lib/command";
import { formatUnknownError } from "./lib/format-error";
import { getPostgresConnectionConfig } from "../src/lib/postgres-connection";

async function resolveSmokeEnv() {
  try {
    return getUiSmokeEnv();
  } catch {
    const { stdout } = await runCommand(
      "supabase",
      ["status", "-o", "env"],
      { quiet: true },
    );

    return getUiSmokeEnv(
      buildUiSmokeCommandEnv(parseSupabaseEnvOutput(stdout)),
    );
  }
}

async function main() {
  const env = await resolveSmokeEnv();
  const connection = getPostgresConnectionConfig(env.databaseUrl);
  const sql = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 1,
    prepare: false,
  });
  const probeId = randomUUID();
  const probeEmail = `smoke-preflight-${probeId}@accelerate-global.test`;
  const selfSignupProbeEmail =
    `smoke-self-signup-${probeId}@accelerate-global.test`;
  const allowlistNote = "UI smoke preflight probe";

  try {
    await sql`select 1`;

    const storageAdmin = createClient(
      env.supabaseUrl,
      getUiSmokeStorageAdminKey(env),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    const listedBuckets = await storageAdmin.storage.listBuckets();

    if (listedBuckets.error) {
      throw new Error(
        `storage admin probe failed: ${listedBuckets.error.message}`,
      );
    }

    await sql`
      insert into public.signup_email_allowlist (email, note)
      values
        (${probeEmail}, ${allowlistNote}),
        (${selfSignupProbeEmail}, ${allowlistNote})
      on conflict (email) do update
      set note = excluded.note, updated_at = now()
    `;
    await sql`
      delete from auth.users
      where email in (${probeEmail}, ${selfSignupProbeEmail})
    `;

    const authClient = createClient(
      env.supabaseUrl,
      env.supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    const selfSignup = await authClient.auth.signUp({
      email: selfSignupProbeEmail,
      password: UI_SMOKE_PASSWORD,
    });

    if (!selfSignup.error || selfSignup.data.user) {
      throw new Error("public email self-signup is unexpectedly enabled");
    }

    const createdUser = await storageAdmin.auth.admin.createUser({
      email: probeEmail,
      password: UI_SMOKE_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "UI Smoke Preflight Probe",
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      throw new Error(
        `admin user-creation probe failed: ${createdUser.error?.message ?? "missing user"}`,
      );
    }

    const signIn = await authClient.auth.signInWithPassword({
      email: probeEmail,
      password: UI_SMOKE_PASSWORD,
    });

    if (signIn.error || !signIn.data.session) {
      throw new Error(
        `auth sign-in probe failed: ${signIn.error?.message ?? "missing session"}`,
      );
    }

    console.log(
      "UI smoke preflight OK: public self-signup is disabled while admin-provisioned email sign-in remains ready.",
    );
  } finally {
    await sql`
      delete from auth.users
      where email in (${probeEmail}, ${selfSignupProbeEmail})
    `;
    await sql`
      delete from public.signup_email_allowlist
      where email in (${probeEmail}, ${selfSignupProbeEmail})
    `;
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error) => {
  console.error(`[bootstrap] UI smoke preflight failed: ${formatUnknownError(error)}`);
  process.exitCode = 1;
});
