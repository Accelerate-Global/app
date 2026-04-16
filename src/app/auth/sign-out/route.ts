import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  if (hasSupabaseConfig()) {
    try {
      const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
      const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });

            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });

            Object.entries(headers).forEach(([key, value]) => {
              response.headers.set(key, value);
            });
          },
        },
      });

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to sign out of Supabase", error);
    }
  }

  return response;
}
