import type { CurrentIdentity } from "@/lib/auth";

export type SiteNavLink = {
  href: string;
  label: string;
};

export function getSiteNavLinks(identity: CurrentIdentity | null): SiteNavLink[] {
  if (identity) {
    if (identity.isDatasetAdmin) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard", label: "Data" },
        { href: "/dashboard/upload", label: "Upload" },
      ];
    }

    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard", label: "Data" },
    ];
  }

  return [
    { href: "/", label: "Home" },
    { href: "/", label: "Data" },
    { href: "/sign-up", label: "Access" },
  ];
}
