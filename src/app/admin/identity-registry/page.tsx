import { ChevronLeftIcon, FingerprintIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IdentityRegistryClient } from "@/components/identity-registry/identity-registry-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getAxIdentityRegistryOverview } from "@/lib/identity-registry";
import { cn } from "@/lib/utils";

type IdentityRegistryPageProps = {
  searchParams?: Promise<{
    runId?: string | string[];
  }>;
};

export default async function IdentityRegistryPage({
  searchParams = Promise.resolve({}),
}: IdentityRegistryPageProps = {}) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/");
  if (!identity.isDatasetAdmin) redirect("/dashboard");
  const [overview, resolvedSearchParams] = await Promise.all([
    getAxIdentityRegistryOverview(),
    searchParams,
  ]);
  const requestedRunId = Array.isArray(resolvedSearchParams.runId)
    ? resolvedSearchParams.runId[0]
    : resolvedSearchParams.runId;

  return (
    <main className="min-h-svh bg-background" data-smoke-page="identity-registry" data-smoke-page-ready="identity-registry">
      <SiteHeader identity={identity} />
      <DashboardPageShell>
        <section className="space-y-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "link", size: "sm" }), "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline")}><ChevronLeftIcon className="size-3.5" />Back to dashboard</Link>
          <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted"><FingerprintIcon className="size-5" /></span><div className="space-y-2"><h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">AX Identity Registry</h1><p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">Review canonical AX codes, candidate conflicts, immutable registry revisions, and identity-enriched publications.</p></div></div>
        </section>
        <IdentityRegistryClient
          initialOverview={overview}
          initialSelectedRunId={requestedRunId}
        />
      </DashboardPageShell>
    </main>
  );
}
