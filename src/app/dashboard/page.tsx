import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SiteHeader } from "@/components/layout/site-header";
import { getAnalyticsWorkspaceRole } from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { listDatasets } from "@/lib/datasets";
import { listSavedDatasetTables } from "@/lib/saved-dataset-tables";

export default async function DashboardPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const [datasets, savedTables] = await Promise.all([
    listDatasets({ includeDisabled: identity.isDatasetAdmin }),
    listSavedDatasetTables(identity.ownerId, {
      includeDisabled: identity.isDatasetAdmin,
    }),
  ]);

  return (
    <main
      data-smoke-page="dashboard"
      data-smoke-page-ready="dashboard"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Dashboard
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Browse and manage your available datasets from one place.
          </p>
        </section>
        <DashboardClient
          initialDatasets={datasets}
          initialSavedTables={savedTables}
          canManageDatasets={identity.isDatasetAdmin}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.isDatasetAdmin)}
        />
      </div>
    </main>
  );
}
