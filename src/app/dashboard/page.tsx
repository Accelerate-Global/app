import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SiteHeader } from "@/components/layout/site-header";
import { getDatasetAdminEmail } from "@/lib/dataset-access";
import { getCurrentIdentity } from "@/lib/auth";
import { listDatasets } from "@/lib/datasets";

export default async function DashboardPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const datasets = await listDatasets();

  return (
    <main className="min-h-svh bg-background">
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-foreground/55">
            Accelerate Global Data
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Dataset viewer
          </h1>
        </section>
        <DashboardClient
          initialDatasets={datasets}
          canUpload={identity.isDatasetAdmin}
          datasetAdminEmail={getDatasetAdminEmail()}
        />
      </div>
    </main>
  );
}
