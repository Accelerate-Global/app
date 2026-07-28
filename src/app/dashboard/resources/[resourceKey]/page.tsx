import { BookOpenTextIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PipelineReferenceResourceClient } from "@/components/dashboard/pipeline-reference-resource-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { formatUtcTimestamp } from "@/lib/date-time";
import {
  getReferenceResourcePage,
  listReferenceResourceCatalog,
} from "@/lib/reference-resources";
import { isPipelineResourceKey } from "@/lib/reference-resources/pipeline-types";
import { cn } from "@/lib/utils";

type PipelineReferenceResourcePageProps = {
  params: Promise<{ resourceKey: string }>;
};

export default async function PipelineReferenceResourcePage({
  params,
}: PipelineReferenceResourcePageProps) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const { resourceKey } = await params;
  if (!isPipelineResourceKey(resourceKey)) {
    notFound();
  }

  const [catalog, page] = await Promise.all([
    listReferenceResourceCatalog(),
    getReferenceResourcePage({ resourceKey, limit: 100 }),
  ]);
  const catalogItem = catalog.find((item) => item.resourceKey === resourceKey);

  if (!catalogItem?.activeVersion) {
    notFound();
  }

  return (
    <div
      data-smoke-page="pipeline-reference-resource"
      data-smoke-page-ready="pipeline-reference-resource"
    >
      <DashboardPageShell>
        <section className="space-y-2">
          <Link
            href="/dashboard/resources"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline",
            )}
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to resources
          </Link>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <BookOpenTextIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                {catalogItem.label}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                {catalogItem.description}
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Updated{" "}
                  {formatUtcTimestamp(
                    page.version.sourceRetrievedAt,
                    "Not available",
                  )}
                </p>
                <p>
                  Used by{" "}
                  {catalogItem.impact.affectedEngines.length > 0
                    ? catalogItem.impact.affectedEngines.join(", ")
                    : "no registered pipelines"}
                  .
                </p>
                {catalogItem.impact.olderOutputCount > 0 ? (
                  <p>
                    {catalogItem.impact.olderOutputCount.toLocaleString()} recent{" "}
                    {catalogItem.impact.olderOutputCount === 1
                      ? "output uses"
                      : "outputs use"}{" "}
                    an older version.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <PipelineReferenceResourceClient
          resourceKey={resourceKey}
          initialEntries={page.entries}
          activeVersion={page.version}
          initialNextCursor={page.nextCursor}
          canManageLifecycle={identity.isDatasetAdmin}
        />
      </DashboardPageShell>
    </div>
  );
}
