import { NextResponse } from "next/server";

import { getCurrentIdentity } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACCOUNT_DISABLE_DURATION = "876000h";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured for account management." },
      { status: 503 },
    );
  }

  const identity = await getCurrentIdentity();

  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      identity.ownerId,
      { ban_duration: ACCOUNT_DISABLE_DURATION },
    );

    if (updateError) {
      throw updateError;
    }

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
    return NextResponse.json(
      { error: "Could not disable the current account." },
      { status: 500 },
    );
  }
}
