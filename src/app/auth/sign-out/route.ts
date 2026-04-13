import { NextResponse } from "next/server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to sign out of Supabase", error);
    }
  }

  return NextResponse.json({ ok: true });
}
