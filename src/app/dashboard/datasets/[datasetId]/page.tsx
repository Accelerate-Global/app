import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DatasetDetailClient } from "@/components/dashboard/dataset-detail-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  getAnalyticsWorkspaceRole,
  type DatasetOpenSource,
} from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
import { getDatasetOpenPresetTag } from "@/lib/dataset-tags";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { getDatasetViewOption } from "@/lib/dataset-view-options";
import { listFilterRegions } from "@/lib/filter-settings";
import { buildDatasetOpenPreset } from "@/lib/saved-dataset-filters";
import { getSavedDatasetTable } from "@/lib/saved-dataset-tables";
import { cn } from "@/lib/utils";

type DatasetPageProps = {
  params: Promise<{
    datasetId: string;
  }>;
  searchParams: Promise<{
    savedTableId?: string;
    source?: string;
  }>;
};

export default async function DatasetPage({
  params,
  searchParams,
}: DatasetPageProps) {
  const identity = await getCurrentIdentity();
  const { datasetId } = await params;
  const { savedTableId, source } = await searchParams;

  if (!identity) {
    redirect("/");
  }

  const dataset = await getDataset(datasetId);

  if (!dataset) {
    notFound();
  }

  const openPresetTag = getDatasetOpenPresetTag(dataset.tags);
  const savedTable = savedTableId
    ? await getSavedDatasetTable({
        ownerId: identity.ownerId,
        savedTableId,
      })
    : null;
  const matchingSavedTable =
    savedTable && savedTable.datasetId === dataset.id ? savedTable : null;
  const initialFilters =
    (matchingSavedTable
      ? buildDatasetOpenPreset(matchingSavedTable.filters)
      : openPresetTag?.openPreset) ?? null;
  const datasetSource =
    source === "saved_table" ||
    source === "default_redirect" ||
    source === "dashboard"
      ? (source satisfies DatasetOpenSource)
      : "dashboard";
  const detailKey = [
    dataset.id,
    matchingSavedTable?.id ?? null,
    openPresetTag?.id ?? null,
    datasetSource,
  ].join(":");

  const [regions, headerDescription, fieldDefinitionPresentationByColumnKey] = await Promise.all([
    listFilterRegions(),
    Promise.resolve(getDatasetViewOption(dataset.fileName)?.description),
    listFieldDefinitionPresentationByColumnKey(dataset.columns),
  ]);

  return (
    <main
      data-smoke-page="dataset-detail"
      data-smoke-page-ready="dataset-detail"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <section className="min-w-0 space-y-2">
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
          <h1 className="truncate text-4xl font-semibold tracking-[-0.04em] sm:text-[3rem]">
            {dataset.fileName}
          </h1>
          {headerDescription ? (
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {headerDescription}
            </p>
          ) : null}
        </section>
        <DatasetDetailClient
          key={detailKey}
          dataset={dataset}
          regions={regions}
          fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
          initialFilters={initialFilters}
          initialSorting={matchingSavedTable?.filters.sorting}
          canManageOpenPresets={identity.isDatasetAdmin}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.isDatasetAdmin)}
          datasetSource={datasetSource}
          initialSavedTableId={matchingSavedTable?.id ?? null}
          initialSavedTableRowCount={matchingSavedTable?.savedRowCount ?? null}
          initialSavedTableFilterSections={
            matchingSavedTable
              ? matchingSavedTable.filters
              : null
          }
          initialPresetTagId={
            matchingSavedTable ? null : openPresetTag?.id ?? null
          }
        />
      </div>
    </main>
  );
}
