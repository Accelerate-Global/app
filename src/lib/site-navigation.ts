import type { CurrentIdentity } from "@/lib/auth";
import { canUsePrivateDataChat } from "@/lib/private-data-chat/access";

export type SiteNavLink = {
  href: string;
  label: string;
};

export function getSiteNavLinks(identity: CurrentIdentity | null): SiteNavLink[] {
  if (identity) {
    return canUsePrivateDataChat(identity)
      ? [{ href: "/dashboard/chat", label: "Data Chat" }]
      : [];
  }

  return [
    { href: "/", label: "Home" },
    { href: "/", label: "Data" },
  ];
}
