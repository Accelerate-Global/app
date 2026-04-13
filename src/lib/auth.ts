import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const BYPASS_OWNER_ID = "bypass-user";
export const BYPASS_COOKIE_NAME = "csv-viewer-bypass-owner";

export type CurrentIdentity = {
  ownerId: string;
  email: string | null;
  mode: "supabase" | "bypass";
};

function isDynamicServerUsageError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    error.digest === "DYNAMIC_SERVER_USAGE"
  );
}

export async function getBypassIdentity(): Promise<CurrentIdentity | null> {
  const cookieStore = await cookies();
  const bypassCookie = cookieStore.get(BYPASS_COOKIE_NAME);

  if (bypassCookie?.value !== BYPASS_OWNER_ID) {
    return null;
  }

  return {
    ownerId: BYPASS_OWNER_ID,
    email: null,
    mode: "bypass",
  };
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        return {
          ownerId: user.id,
          email: user.email ?? null,
          mode: "supabase",
        };
      }
    } catch (error) {
      if (isDynamicServerUsageError(error)) {
        throw error;
      }

      console.error("Failed to resolve Supabase user", error);
    }
  }

  return getBypassIdentity();
}

export async function getCurrentOwnerId() {
  const identity = await getCurrentIdentity();
  return identity?.ownerId ?? null;
}
