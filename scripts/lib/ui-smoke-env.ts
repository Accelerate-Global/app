import {
  UI_SMOKE_BASE_URL,
  UI_SMOKE_USERS,
} from "../../tests/ui/support/smoke-data";

export type UiSmokeEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey: string | null;
  supabaseServiceRoleKey: string | null;
  databaseUrl: string;
  datasetAdminEmail: string;
  storageBucket: string;
};

function requireValue(
  environment: NodeJS.ProcessEnv,
  key: string,
  message: string,
) {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function parseSupabaseEnvOutput(output: string) {
  const entries: Record<string, string> = {};

  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.+)$/u);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

export function buildUiSmokeCommandEnv(statusEnv: Record<string, string>) {
  const supabaseUrl =
    statusEnv.NEXT_PUBLIC_SUPABASE_URL ??
    statusEnv.API_URL ??
    statusEnv.SUPABASE_URL;
  const publishableKey =
    statusEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    statusEnv.ANON_KEY ??
    statusEnv.PUBLISHABLE_KEY;
  const serviceRoleKey =
    statusEnv.SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;
  const secretKey =
    statusEnv.SUPABASE_SECRET_KEY ?? statusEnv.SECRET_KEY;
  const databaseUrl = statusEnv.DATABASE_URL ?? statusEnv.DB_URL;

  if (!supabaseUrl || !publishableKey || (!serviceRoleKey && !secretKey) || !databaseUrl) {
    throw new Error(
      "[bootstrap] Could not derive local Supabase env values from `supabase status -o env`.",
    );
  }

  return {
    ...process.env,
    UI_SMOKE_ENABLED: "1",
    UI_SMOKE_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publishableKey,
    ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}),
    ...(serviceRoleKey ? { SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } : {}),
    DATABASE_URL: databaseUrl,
    DATASET_ADMIN_EMAIL: UI_SMOKE_USERS.admin.email,
    SUPABASE_STORAGE_BUCKET: "datasets",
  };
}

export function getUiSmokeEnv(environment: NodeJS.ProcessEnv = process.env): UiSmokeEnv {
  const supabaseUrl =
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    environment.API_URL?.trim() ??
    requireValue(
      environment,
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL is required for UI smoke bootstrap.",
    );
  const supabasePublishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    environment.ANON_KEY?.trim() ??
    requireValue(
      environment,
      "PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for UI smoke bootstrap.",
    );
  const databaseUrl =
    environment.DATABASE_URL?.trim() ??
    requireValue(
      environment,
      "DB_URL",
      "DATABASE_URL is required for UI smoke bootstrap.",
    );

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY?.trim() ?? null,
    supabaseServiceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? null,
    databaseUrl,
    datasetAdminEmail:
      environment.DATASET_ADMIN_EMAIL?.trim() ?? UI_SMOKE_USERS.admin.email,
    storageBucket: environment.SUPABASE_STORAGE_BUCKET?.trim() || "datasets",
  };
}

export function getUiSmokeStorageAdminKey(environment: UiSmokeEnv) {
  const managementKey =
    environment.supabaseSecretKey ?? environment.supabaseServiceRoleKey;

  if (!managementKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for UI smoke storage access.",
    );
  }

  return managementKey;
}
