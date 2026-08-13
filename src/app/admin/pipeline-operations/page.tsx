import { ActivityIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PipelineOperationsClient } from "@/components/pipeline-operations/pipeline-operations-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import {
  listPipelineFlowDefinitions,
  listPipelineFlowRuns,
  listPipelineScheduleStates,
  registeredPipelineStageHandlers,
} from "@/lib/pipeline-operations";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelineOperationsPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/");
  if (!identity.isDatasetAdmin) redirect("/dashboard");

  const [runs, schedules] = await Promise.all([
    listPipelineFlowRuns({ limit: 100 }),
    listPipelineScheduleStates(),
  ]);

  return (
    <main
      className="min-h-svh bg-background"
      data-smoke-page="pipeline-operations"
      data-smoke-page-ready="pipeline-operations"
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
              <ActivityIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Pipelines
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Run, review, recover, and inspect the durable data workflows that
                produce formed datasets and aggregate candidates.
              </p>
            </div>
          </div>
        </section>
        <PipelineOperationsClient
          definitions={listPipelineFlowDefinitions()}
          initialRuns={runs}
          initialSchedules={schedules}
          availableEffectKeys={Object.keys(registeredPipelineStageHandlers)}
        />
      </DashboardPageShell>
    </main>
  );
}
