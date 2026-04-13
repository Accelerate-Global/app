import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { signupEmailAllowlist } from "@/db/schema";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isEmailAllowedForSignup(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const [allowedEmail] = await getDb()
    .select({ email: signupEmailAllowlist.email })
    .from(signupEmailAllowlist)
    .where(eq(signupEmailAllowlist.email, normalizedEmail))
    .limit(1);

  return Boolean(allowedEmail);
}
