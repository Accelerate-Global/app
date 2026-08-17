import { NextResponse, type NextRequest } from "next/server";

import { applyPrivateNoStoreHeaders } from "@/lib/http";
import { validateMutationOrigin } from "@/lib/request-security";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security-headers";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nodeEnv: process.env.NODE_ENV,
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const requestHeaders = new Headers(request.headers);
  const responseHeaders = new Headers({
    "Content-Security-Policy": contentSecurityPolicy,
  });
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const originCheck = validateMutationOrigin(request);

  if (!originCheck.ok) {
    return applyPrivateNoStoreHeaders(
      NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403, headers: responseHeaders },
      ),
    );
  }

  return updateSession(request, { requestHeaders, responseHeaders });
}

export const config = {
  matcher: [
    "/((?!_next|\\.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
