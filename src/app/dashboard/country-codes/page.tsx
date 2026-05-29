import { Globe2Icon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IsoCountryCodesClient } from "@/components/dashboard/iso-country-codes-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedIsoCountryCodeResourceWithOverrides } from "@/lib/iso-country-codes";
import { cn } from "@/lib/utils";

export default async function CountryCodesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const resource = await getGeneratedIsoCountryCodeResourceWithOverrides();

  return (
    <div
      data-smoke-page="iso-country-codes"
      data-smoke-page-ready="iso-country-codes"
    >
      <DashboardPageShell>
        <section className="space-y-2">
          <Link
            href="/dashboard/resources"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "inline-flex items-center gap-1 px-0 text-[0.78rem] font-black uppercase tracking-[0.12em] no-underline hover:no-underline",
            )}
          >
            <ChevronLeftIcon className="size-3.5" />
            Back to resources
          </Link>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Globe2Icon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Country & Territory Codes
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Search curated country and territory codes enriched with ISO,
                GENC, legacy FIPS, and alternative names for shared dataset work.
              </p>
            </div>
          </div>
        </section>

        <IsoCountryCodesClient
          initialResource={resource}
          canRefresh={identity.isDatasetAdmin}
          canEditAlternativeNames={identity.isDatasetAdmin}
        />
      </DashboardPageShell>
    </div>
  );
}
