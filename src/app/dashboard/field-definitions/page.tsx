import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FieldDefinitionsClient } from "@/components/dashboard/field-definitions-client";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentIdentity } from "@/lib/auth";
import { listFieldDefinitions } from "@/lib/field-definitions";
import { cn } from "@/lib/utils";

export default async function FieldDefinitionsPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const fieldDefinitions = await listFieldDefinitions();

  return (
    <main className="min-h-svh bg-background">
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
            Field Definitions
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Manage the shared definitions shown from dataset header info icons.
          </p>
        </section>
        <FieldDefinitionsClient
          initialFieldDefinitions={fieldDefinitions}
          canEdit={identity.isDatasetAdmin}
        />
      </div>
    </main>
  );
}
