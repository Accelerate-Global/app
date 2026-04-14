import type { CurrentIdentity } from "@/lib/auth";

export function getIdentityDisplayName(identity: Pick<CurrentIdentity, "fullName" | "email">) {
  const fullName = identity.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const emailPrefix = identity.email?.split("@")[0]?.trim();

  if (emailPrefix) {
    return emailPrefix;
  }

  return "Account";
}

export function getIdentityInitials(identity: Pick<CurrentIdentity, "fullName" | "email">) {
  const source = getIdentityDisplayName(identity)
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

  if (!source) {
    return "AG";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
