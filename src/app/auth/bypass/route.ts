import { NextResponse } from "next/server";

import { BYPASS_COOKIE_NAME, BYPASS_OWNER_ID } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({
    ownerId: BYPASS_OWNER_ID,
    mode: "bypass",
  });

  response.cookies.set(BYPASS_COOKIE_NAME, BYPASS_OWNER_ID, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
