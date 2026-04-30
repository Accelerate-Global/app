import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeAuthRedirectPath,
} from "@/lib/auth-redirect";
import { getEffectiveRequestOrigin } from "@/lib/request-security";
import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getEffectiveRequestOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = searchParams.get("next");
  const isRecoveryFlow =
    type === "recovery" || requestedNext?.startsWith("/reset-password");
  const next = sanitizeAuthRedirectPath(
    requestedNext,
    isRecoveryFlow ? "/reset-password" : DEFAULT_AUTH_REDIRECT_PATH,
  );
  let response = NextResponse.redirect(new URL(next, origin));

  if (hasSupabaseConfig()) {
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

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return response;
      }
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (!error) {
        return response;
      }
    }
  }

  response = NextResponse.redirect(
    new URL(
      isRecoveryFlow
        ? "/forgot-password?message=Recovery link could not be verified."
        : "/?message=Confirmation link could not be verified.",
      origin,
    ),
  );

  return response;
}
