import { redirect } from "next/navigation";

import { DatasetUploadClient } from "@/components/dashboard/dataset-upload-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset, isPipelineManagedDataset } from "@/lib/datasets";
import { getDatasetClassification } from "@/lib/dataset-tags";

type UploadPageProps = {
  searchParams: Promise<{
    replace?: string;
  }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const { replace } = await searchParams;
  if (!replace) {
    redirect("/dashboard/datasets/new?source=csv");
  }
  const targetDataset = await getDataset(replace, { includeDisabled: true });
  const backingDataset =
    targetDataset?.backingDatasetId
      ? await getDataset(targetDataset.backingDatasetId, {
          includeDisabled: true,
        })
      : null;

  if (!targetDataset) {
    redirect("/dashboard");
  }

  if (await isPipelineManagedDataset(targetDataset.id)) {
    redirect(`/dashboard/datasets/${targetDataset.id}/edit`);
  }

  return (
    <div
      data-smoke-page="upload"
      data-smoke-page-ready="upload"
    >
      <DashboardPageShell>
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Replace dataset
          </h1>
          <p className="text-sm text-muted-foreground">
            Replacing{" "}
            <span className="font-medium text-foreground">
              {targetDataset.fileName}
            </span>
            {targetDataset.backingDatasetId
              ? " will create an independent source dataset for this view and will not update its current backing dataset."
              : ""}
          </p>
        </section>
        <DatasetUploadClient
          targetDataset={targetDataset}
          preferredClassification={
            backingDataset ? getDatasetClassification(backingDataset.tags) : null
          }
        />
      </DashboardPageShell>
    </div>
  );
}
