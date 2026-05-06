import { Globe2Icon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { IsoCountryCodesClient } from "@/components/dashboard/iso-country-codes-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedIsoCountryCodeResource } from "@/lib/iso-country-codes";
import { cn } from "@/lib/utils";

export default async function CountryCodesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const resource = getGeneratedIsoCountryCodeResource();

  return (
    <main
      data-smoke-page="iso-country-codes"
      data-smoke-page-ready="iso-country-codes"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
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
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Globe2Icon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                ISO3 Country Codes
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Search the official ISO 3166-1 country name to alpha-3 code
                resource used for shared dataset work.
              </p>
            </div>
          </div>
        </section>

        <IsoCountryCodesClient initialResource={resource} />
      </div>
    </main>
  );
}
