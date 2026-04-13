import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountControl } from "@/components/auth/account-control";
import { DatasetTable } from "@/components/dashboard/dataset-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";

type DatasetPageProps = {
  params: Promise<{
    datasetId: string;
  }>;
};

export default async function DatasetPage({ params }: DatasetPageProps) {
  const identity = await getCurrentIdentity();
  const { datasetId } = await params;

  if (!identity) {
    redirect("/");
  }

  const dataset = await getDataset(datasetId);

  if (!dataset) {
    notFound();
  }

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              Back to datasets
            </Link>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">
              {dataset.fileName}
            </h1>
          </div>
          <AccountControl identity={identity} />
        </header>
        <DatasetTable
          dataset={dataset}
          canDelete={identity.isDatasetAdmin}
        />
      </div>
    </main>
  );
}
