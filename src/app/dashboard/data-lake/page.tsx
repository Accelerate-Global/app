import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function DataLakePage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  return (
    <main
      data-smoke-page="data-lake"
      data-smoke-page-ready="data-lake"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-4">
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
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
              Field Sources
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Field Sources gives the workspace a dedicated home for
              understanding where shared field data originates and how those
              source relationships are managed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
