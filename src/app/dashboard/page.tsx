import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
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
    <div
      data-smoke-page="dashboard"
      data-smoke-page-ready="dashboard"
    >
      <DashboardPageShell>
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
          workspaceRole={getAnalyticsWorkspaceRole(identity.workspaceRole)}
        />
      </DashboardPageShell>
    </div>
  );
}
