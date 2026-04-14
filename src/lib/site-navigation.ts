import type { CurrentIdentity } from "@/lib/auth";

export type SiteNavLink = {
  href: string;
  label: string;
};

export function getSiteNavLinks(identity: CurrentIdentity | null): SiteNavLink[] {
  if (identity) {
    return [];
  }

  return [
    { href: "/", label: "Home" },
    { href: "/", label: "Data" },
    { href: "/sign-up", label: "Access" },
  ];
}
