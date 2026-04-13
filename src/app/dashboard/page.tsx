import { redirect } from "next/navigation";

import { AccountControl } from "@/components/auth/account-control";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getCurrentIdentity } from "@/lib/auth";
import { listDatasets } from "@/lib/datasets";

export default async function DashboardPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const datasets = await listDatasets(identity.ownerId);

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-sm text-muted-foreground">CSV workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Dataset viewer
            </h1>
          </div>
          <AccountControl identity={identity} />
        </header>
        <DashboardClient initialDatasets={datasets} />
      </div>
    </main>
  );
}
