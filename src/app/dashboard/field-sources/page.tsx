import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FieldSourcesClient } from "@/components/dashboard/field-sources-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import { cn } from "@/lib/utils";

export default async function FieldSourcesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const { fieldSourceTypes, fieldSources } = await listFieldSourceGridData();

  return (
    <main
      data-smoke-page="field-sources"
      data-smoke-page-ready="field-sources"
      className="min-h-svh bg-background"
    >
      <SiteHeader identity={identity} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-3">
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
            Field Sources
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Field Sources gives the workspace a dedicated home for
            understanding where shared field data originates and how those
            source relationships are managed.
          </p>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Review which source fields currently map to each shared workspace
            field. These mappings are available here as read-only reference
            data.
          </p>
        </section>
        <FieldSourcesClient
          initialFieldSourceTypes={fieldSourceTypes}
          initialFieldSources={fieldSources}
        />
      </div>
    </main>
  );
}
