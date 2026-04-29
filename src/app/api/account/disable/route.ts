import { NextResponse } from "next/server";

import { logError } from "@/lib/error-logging";
import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceAdminCount,
  getActiveWorkspaceSuperAdminCount,
  listWorkspaceUsers,
  setWorkspaceUserDisabled,
} from "@/lib/user-management";
import {
  canDisableOwnAccount,
  isWorkspaceAdmin,
  isWorkspaceSuperAdmin,
} from "@/lib/workspace-role";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return jsonError("Supabase is not configured for account management.", 503);
  }

  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!canDisableOwnAccount(identity.workspaceRole)) {
    return jsonError("Basic accounts cannot disable themselves.", 403);
  }

  try {
    if (identity.isDatasetAdmin) {
      const users = await listWorkspaceUsers();
      const activeAdminCount = getActiveWorkspaceAdminCount(users);
      const activeSuperAdminCount = getActiveWorkspaceSuperAdminCount(users);
      const currentUser = users.find((user) => user.id === identity.ownerId);

      if (
        currentUser &&
        isWorkspaceSuperAdmin(currentUser?.workspaceRole) &&
        currentUser.accountStatus !== "disabled" &&
        activeSuperAdminCount <= 1
      ) {
        return jsonError(
          "The last active super admin cannot disable their own account.",
          409,
        );
      }

      if (
        currentUser &&
        isWorkspaceAdmin(currentUser?.workspaceRole) &&
        currentUser.accountStatus !== "disabled" &&
        activeAdminCount <= 1
      ) {
        return jsonError(
          "The last active admin-capable account cannot disable their own account.",
          409,
        );
      }
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const admin = createSupabaseAdminClient();
    await setWorkspaceUserDisabled(identity.ownerId, true);

    if (session?.access_token) {
      const { error: signOutError } = await admin.auth.admin.signOut(
        session.access_token,
        "global",
      );

      if (signOutError) {
        logError("Failed to revoke current sessions", signOutError);
      }
    }

    const { error: sessionError } = await supabase.auth.signOut();

    if (sessionError) {
      logError("Failed to clear current session cookies", sessionError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Failed to disable account", error);
    return jsonError("Could not disable the current account.", 500);
  }
}
