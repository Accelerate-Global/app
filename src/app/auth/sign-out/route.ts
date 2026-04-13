import { NextResponse } from "next/server";

import { BYPASS_COOKIE_NAME } from "@/lib/auth";
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

  const response = NextResponse.json({ ok: true });
  response.cookies.set(BYPASS_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
