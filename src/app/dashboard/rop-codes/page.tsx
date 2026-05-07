import { ChevronLeftIcon, NetworkIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RopCodesClient } from "@/components/dashboard/rop-codes-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedRopCodeResource } from "@/lib/rop-codes";
import { cn } from "@/lib/utils";

export default async function RopCodesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  return (
    <main
      data-smoke-page="rop-codes"
      data-smoke-page-ready="rop-codes"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
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
              <NetworkIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                ROP Codes
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Search HIS Registry of Peoples ROP1, ROP2, ROP25, and ROP3
                codes matched into one shared lookup resource.
              </p>
            </div>
          </div>
        </section>

        <RopCodesClient
          initialResource={getGeneratedRopCodeResource()}
          canRefresh={identity.isDatasetAdmin}
        />
      </DashboardPageShell>
    </main>
  );
}
