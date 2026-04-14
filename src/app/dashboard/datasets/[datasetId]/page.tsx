import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DatasetTable } from "@/components/dashboard/dataset-table";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
import { cn } from "@/lib/utils";

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
            Back to datasets
          </Link>
          <h1 className="truncate text-4xl font-semibold tracking-[-0.04em] sm:text-[3rem]">
            {dataset.fileName}
          </h1>
        </section>
        <DatasetTable dataset={dataset} />
      </div>
    </main>
  );
}
