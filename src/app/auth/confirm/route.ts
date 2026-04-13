import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/?message=Confirmation link could not be verified.", origin),
  );
}
