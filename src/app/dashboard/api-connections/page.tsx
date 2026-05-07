import { CableIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ApiConnectionsClient } from "@/components/dashboard/api-connections-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { listApiConnections } from "@/lib/api-connections";
import { cn } from "@/lib/utils";

export default async function ApiConnectionsPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const { connections, runs, resources } = await listApiConnections();

  return (
    <main
      data-smoke-page="api-connections"
      data-smoke-page-ready="api-connections"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <DashboardPageShell>
        <section className="space-y-2">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline",
            )}
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to dashboard
          </Link>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <CableIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Datasets
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Run code-managed API connections and import responses into shared
                datasets.
              </p>
            </div>
          </div>
        </section>

        <ApiConnectionsClient
          initialConnections={connections}
          initialRuns={runs}
          initialResources={resources}
        />
      </DashboardPageShell>
    </main>
  );
}
