import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentIdentity } from "@/lib/auth";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  return (
    <main className="min-h-svh bg-background">
      <SiteHeader identity={identity} />
      {children}
    </main>
  );
}
