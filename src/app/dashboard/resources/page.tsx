import { ChevronLeftIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceCatalog } from "@/lib/reference-resources";
import { cn } from "@/lib/utils";

export default async function ResourcesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const builtInResources = await listReferenceResourceCatalog({
    includeAdminState: identity.isDatasetAdmin,
  });

  return (
    <div
      data-smoke-page="resources"
      data-smoke-page-ready="resources"
    >
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
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <FileTextIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Resources
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Built-in lookup resources for dataset review and cleanup work.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {builtInResources.map((resource) => (
            <Link
              key={resource.id}
              href={resource.routePath}
              className="block rounded-lg no-underline outline-none transition-opacity hover:opacity-85 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full cursor-pointer transition-colors hover:bg-muted/30">
                <CardHeader className="gap-2">
                  <CardTitle className="text-xl">{resource.label}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                  {resource.activeVersion ? (
                    <CardDescription>
                      Active v{resource.activeVersion.versionNumber} · Retrieved{" "}
                      {new Date(resource.activeVersion.sourceRetrievedAt).toLocaleDateString()}
                    </CardDescription>
                  ) : (
                    <CardDescription className="text-destructive">
                      No active version
                    </CardDescription>
                  )}
                  {resource.attentionState ? (
                    <CardDescription className="font-medium text-amber-700">
                      {resource.attentionState.replaceAll("-", " ")}
                    </CardDescription>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>
      </DashboardPageShell>
    </div>
  );
}
