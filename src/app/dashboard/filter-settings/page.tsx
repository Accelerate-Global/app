import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FilterSettingsClient } from "@/components/dashboard/filter-settings-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getAnalyticsWorkspaceRole } from "@/lib/analytics";
import { listFilterRegions, listRegionCountryOptions } from "@/lib/filter-settings";
import { cn } from "@/lib/utils";

export default async function FilterSettingsPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const [regions, countryOptions] = await Promise.all([
    listFilterRegions(),
    listRegionCountryOptions(),
  ]);

  return (
    <main
      data-smoke-page="filter-settings"
      data-smoke-page-ready="filter-settings"
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
            Filter Settings
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Configure the shared dataset filter selections that users can turn on from the dataset page.
          </p>
        </section>
        <FilterSettingsClient
          initialRegions={regions}
          countryOptions={countryOptions}
          actorOwnerId={identity.ownerId}
          workspaceRole={getAnalyticsWorkspaceRole(identity.isDatasetAdmin)}
        />
      </div>
    </main>
  );
}
