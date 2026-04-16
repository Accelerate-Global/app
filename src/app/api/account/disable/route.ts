import { NextResponse } from "next/server";

import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceAdminCount,
  listWorkspaceUsers,
  setWorkspaceUserDisabled,
} from "@/lib/user-management";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return jsonError("Supabase is not configured for account management.", 503);
  }

  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    if (identity.isDatasetAdmin) {
      const users = await listWorkspaceUsers();
      const activeAdminCount = getActiveWorkspaceAdminCount(users);
      const currentUser = users.find((user) => user.id === identity.ownerId);

      if (
        currentUser?.workspaceRole === "admin" &&
        currentUser.accountStatus !== "disabled" &&
        activeAdminCount <= 1
      ) {
        return jsonError("The last active admin cannot disable their own account.", 409);
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
        console.error("Failed to revoke current sessions", signOutError);
      }
    }

    const { error: sessionError } = await supabase.auth.signOut();

    if (sessionError) {
      console.error("Failed to clear current session cookies", sessionError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to disable account", error);
    return jsonError("Could not disable the current account.", 500);
  }
}
