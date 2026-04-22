import { redirect } from "next/navigation";

import { DatasetUploadClient } from "@/components/dashboard/dataset-upload-client";
import { SiteHeader } from "@/components/layout/site-header";
import { getAnalyticsWorkspaceRole } from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";

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
  const targetDataset = replace
    ? await getDataset(replace, { includeDisabled: true })
    : null;

  if (replace && !targetDataset) {
    redirect("/dashboard");
  }

  return (
    <main
      data-smoke-page="upload"
      data-smoke-page-ready="upload"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            {targetDataset ? "Replace dataset" : "Upload dataset"}
          </h1>
          {targetDataset ? (
            <p className="text-sm text-muted-foreground">
              Replacing{" "}
              <span className="font-medium text-foreground">
                {targetDataset.fileName}
              </span>
              {targetDataset.backingDatasetId
                ? " will create an independent source dataset for this view and will not update its current backing dataset."
                : ""}
            </p>
          ) : null}
        </section>
        <DatasetUploadClient
          targetDataset={targetDataset}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.isDatasetAdmin)}
        />
      </div>
    </main>
  );
}
