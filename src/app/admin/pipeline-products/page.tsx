import { ChevronLeftIcon, Layers3Icon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PipelineProductsClient } from "@/components/pipeline-products/pipeline-products-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import {
  getPipelineProductSystemState,
  listEligibleIdentityPublications,
  listPipelineDefinitions,
  listPipelineProductPublications,
  listPipelineReleaseSets,
  listPipelineRuns,
} from "@/lib/pipeline-products";
import { cn } from "@/lib/utils";

export default async function PipelineProductsPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/");
  if (!identity.isDatasetAdmin) redirect("/dashboard");

  const [system, eligibleIdentityPublications, releases, publications, runs] = await Promise.all([
    getPipelineProductSystemState(),
    listEligibleIdentityPublications(),
    listPipelineReleaseSets(),
    listPipelineProductPublications(),
    listPipelineRuns(),
  ]);
  const definitions = listPipelineDefinitions().map((definition) => ({
    key: definition.key,
    stage: definition.stage,
    displayName: definition.displayName,
    version: definition.version,
    checksum: definition.checksum,
    requiredInputKeys: definition.requiredInputKeys,
    outputClassification: definition.outputClassification,
    publicationTargetKey: definition.publicationTargetKey,
  }));

  return (
    <main className="min-h-svh bg-background" data-smoke-page="pipeline-products" data-smoke-page-ready="pipeline-products">
      <SiteHeader identity={identity} />
      <DashboardPageShell>
        <section className="space-y-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "link", size: "sm" }), "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline")}><ChevronLeftIcon className="size-3.5" />Back to dashboard</Link>
          <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted"><Layers3Icon className="size-5" /></span><div className="space-y-2"><h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">Pipeline Products</h1><p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">Finalize exact source releases, build Tier 1 and Aggregate 1 products, review evidence, and publish approved outputs to stable dataset targets.</p></div></div>
        </section>
        <PipelineProductsClient initialOverview={{ system, definitions, eligibleIdentityPublications, releases, publications, runs }} />
      </DashboardPageShell>
    </main>
  );
}
