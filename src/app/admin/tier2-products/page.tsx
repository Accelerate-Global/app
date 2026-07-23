import { ChevronLeftIcon, NetworkIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { Tier2ProductsAdmin } from "@/components/tier2-products/tier2-products-admin";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { getTier2AdminOverview } from "@/lib/tier2-products";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Tier2ProductsPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/");
  if (!identity.isDatasetAdmin) redirect("/dashboard");
  const overview = await getTier2AdminOverview();

  return (
    <main
      className="min-h-svh bg-background"
      data-smoke-page="tier2-products"
      data-smoke-page-ready="tier2-products"
    >
      <SiteHeader identity={identity} />
      <DashboardPageShell>
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
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <NetworkIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Tier 2 Products
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Pin each partner’s Sheet contract and resources, review forming and identity evidence,
                then publish exact Tier 2 and Aggregate 2 releases.
              </p>
            </div>
          </div>
        </section>
        <Tier2ProductsAdmin initialOverview={overview} />
      </DashboardPageShell>
    </main>
  );
}
