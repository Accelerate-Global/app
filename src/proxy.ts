import { NextResponse, type NextRequest } from "next/server";

import { validateMutationOrigin } from "@/lib/request-security";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const originCheck = validateMutationOrigin(request);

  if (!originCheck.ok) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
