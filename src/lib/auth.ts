import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { isWorkspaceAdmin } from "@/lib/workspace-role";

export type CurrentIdentity = {
  ownerId: string;
  email: string | null;
  fullName: string | null;
  isDatasetAdmin: boolean;
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
        const email = user.email ?? null;
        const fullName =
          typeof user.user_metadata?.full_name === "string" &&
            user.user_metadata.full_name.trim()
            ? user.user_metadata.full_name.trim()
            : null;

        return {
          ownerId: user.id,
          email,
          fullName,
          isDatasetAdmin: isWorkspaceAdmin(user.app_metadata?.workspace_role),
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
