import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export type CurrentIdentity = {
  ownerId: string;
  email: string | null;
  mode: "supabase";
};

function isDynamicServerUsageError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    error.digest === "DYNAMIC_SERVER_USAGE"
  );
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  if (hasSupabaseConfig()) {
    try {
      await cookies();
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

  return null;
}

export async function getCurrentOwnerId() {
  const identity = await getCurrentIdentity();
  return identity?.ownerId ?? null;
}
