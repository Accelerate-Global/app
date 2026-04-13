import { NextResponse } from "next/server";

import { isEmailAllowedForSignup } from "@/lib/signup-allowlist";

export async function POST(request: Request) {
  let email: string;

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json(
      { message: "A valid email address is required." },
      { status: 400 },
    );
  }

  if (!email.trim()) {
    return NextResponse.json(
      { message: "A valid email address is required." },
      { status: 400 },
    );
  }

  const isAllowed = await isEmailAllowedForSignup(email);

  if (!isAllowed) {
    return NextResponse.json(
      {
        message:
          "This email address has not been granted access yet. Ask an administrator to add it to the signup allowlist first.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
