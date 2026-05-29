import { cookies, headers } from "next/headers";

import { readProxiedIdentityHeaders } from "@/lib/auth-identity-headers";
import { logError } from "@/lib/error-logging";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import {
  getWorkspaceRole,
  isWorkspaceAdmin,
  type WorkspaceRole,
} from "@/lib/workspace-role";

export type CurrentIdentity = {
  ownerId: string;
  email: string | null;
  fullName: string | null;
  workspaceRole: WorkspaceRole;
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

function toCurrentIdentity(
  identity: Pick<CurrentIdentity, "ownerId" | "email" | "fullName" | "workspaceRole">,
): CurrentIdentity {
  return {
    ...identity,
    isDatasetAdmin: isWorkspaceAdmin(identity.workspaceRole),
    mode: "supabase",
  };
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  if (hasSupabaseConfig()) {
    try {
      const proxiedIdentity = readProxiedIdentityHeaders(await headers());

      if (proxiedIdentity) {
        return toCurrentIdentity(proxiedIdentity);
      }

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

        const workspaceRole = getWorkspaceRole(user.app_metadata?.workspace_role);

        return toCurrentIdentity({
          ownerId: user.id,
          email,
          fullName,
          workspaceRole,
        });
      }
    } catch (error) {
      if (isDynamicServerUsageError(error)) {
        throw error;
      }

      logError("Failed to resolve Supabase user", error);
    }
  }

  return null;
}

export async function getCurrentOwnerId() {
  const identity = await getCurrentIdentity();
  return identity?.ownerId ?? null;
}
