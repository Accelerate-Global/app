import { CableIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApiConnectionDetailClient } from "@/components/dashboard/api-connection-detail-client";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getApiConnection, listApiConnectionRuns } from "@/lib/api-connections";
import type { ApiConnectionRunStatus } from "@/lib/api-types";
import { getCurrentIdentity } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ApiConnectionDetailPageProps = {
  params: Promise<{
    connectionId: string;
  }>;
};

type HeaderStatus = ApiConnectionRunStatus | "idle";

const HEADER_STATUS_LABELS: Record<HeaderStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  running: "Running",
  success: "Success",
  failed: "Failed",
};

function headerStatusClass(status: HeaderStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "queued") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted/60 text-muted-foreground";
}

export default async function ApiConnectionDetailPage({
  params,
}: ApiConnectionDetailPageProps) {
  const identity = await getCurrentIdentity();
  const { connectionId } = await params;

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const connection = await getApiConnection(connectionId);

  if (!connection) {
    notFound();
  }

  const runs = await listApiConnectionRuns(connection.id);
  const headerStatus = runs[0]?.status ?? "idle";

  return (
    <main
      data-smoke-page="api-connection-detail"
      data-smoke-page-ready="api-connection-detail"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <Link
            href="/dashboard/api-connections"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline",
            )}
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to API connections
          </Link>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <CableIcon className="size-5" />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                  {connection.name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn("capitalize", headerStatusClass(headerStatus))}
                >
                  {HEADER_STATUS_LABELS[headerStatus]}
                </Badge>
              </div>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {connection.description || "Code-managed connection"}
              </p>
            </div>
          </div>
        </section>

        <ApiConnectionDetailClient connection={connection} initialRuns={runs} />
      </div>
    </main>
  );
}
