import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DatasetEditPageClient } from "@/components/dashboard/dataset-edit-page-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getAnalyticsWorkspaceRole } from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset, listDatasetVersions, listDatasets } from "@/lib/datasets";
import { getReusableDatasetTags } from "@/lib/dataset-tags";
import { cn } from "@/lib/utils";

type DatasetEditPageProps = {
  params: Promise<{
    datasetId: string;
  }>;
};

export default async function DatasetEditPage({
  params,
}: DatasetEditPageProps) {
  const identity = await getCurrentIdentity();
  const { datasetId } = await params;

  if (!identity) {
    redirect("/");
  }

  const dataset = await getDataset(datasetId);

  if (!dataset) {
    notFound();
  }

  if (!identity.isDatasetAdmin) {
    redirect(`/dashboard/datasets/${dataset.id}`);
  }

  const [datasets, versions] = await Promise.all([
    listDatasets(),
    dataset.backingDatasetId ? Promise.resolve([]) : listDatasetVersions(dataset.id),
  ]);
  const availableTags = getReusableDatasetTags(
    datasets.flatMap((item) => item.tags),
  );

  return (
    <main
      data-smoke-page="dataset-edit"
      data-smoke-page-ready="dataset-edit"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
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
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Edit dataset
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {dataset.backingDatasetId
              ? `Update ${dataset.fileName} and manage its tags, displayed fields, and default view settings from one place.`
              : `Update ${dataset.fileName} and manage its tags, displayed fields, and upload history from one place.`}
          </p>
        </section>
        <DatasetEditPageClient
          initialDataset={dataset}
          availableTags={availableTags}
          initialVersions={versions ?? []}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.isDatasetAdmin)}
        />
      </div>
    </main>
  );
}
