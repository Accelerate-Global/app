import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DataLakeClient } from "@/components/dashboard/data-lake-client";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentIdentity } from "@/lib/auth";
import { listDataLakeSources } from "@/lib/data-lake";
import { cn } from "@/lib/utils";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function DataLakePage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const sources = await listDataLakeSources({
    includeDisabled: identity.isDatasetAdmin,
  });
  const participatingOrganizationCount = new Set(
    sources.map((source) => source.displayName.trim().toLowerCase()),
  ).size;
  const unnamedSourceCount = sources.filter(
    (source) => !source.sourceOrganizationName,
  ).length;

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
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="rounded-full px-3 text-[0.68rem] uppercase tracking-[0.12em]"
            >
              Shared source catalog
            </Badge>
            <Badge
              variant={identity.isDatasetAdmin ? "secondary" : "outline"}
              className="rounded-full px-3 text-[0.68rem] uppercase tracking-[0.12em]"
            >
              {identity.isDatasetAdmin
                ? "Admin organization naming enabled"
                : "Admin naming stays restricted"}
            </Badge>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
              Data Partners
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              Track which organizations are currently feeding data into the
              workspace. Everyone can review the participating source feeds,
              their latest upload activity, and their publish status, while
              organization naming stays restricted to admins.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Source feeds</CardTitle>
              <CardDescription>
                Physical datasets currently feeding the workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCount(sources.length)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Participating orgs</CardTitle>
              <CardDescription>
                Distinct organization labels currently represented in the lake.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {formatCount(participatingOrganizationCount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Needs naming</CardTitle>
              <CardDescription>
                Source feeds still relying on their dataset filename as the label.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {formatCount(unnamedSourceCount)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Incoming sources</CardTitle>
              <CardDescription>
                One row per source dataset that currently contributes data to the
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataLakeClient
                initialSources={sources}
                canEdit={identity.isDatasetAdmin}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Naming policy</CardTitle>
              <CardDescription>
                Keep the shared catalog visible to everyone while reserving
                provider naming changes for admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Organization labels default to the dataset filename until an
                admin standardizes them. That keeps the source visible even
                before naming is curated.
              </p>
              <p>
                {identity.isDatasetAdmin
                  ? "You can rename organizations inline from the source table without changing what standard users can see."
                  : "You can review the full shared source catalog here, but organization naming remains an admin-only action."}
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "justify-start",
                  )}
                >
                  Open dashboard
                </Link>
                {identity.isDatasetAdmin ? (
                  <Link
                    href="/dashboard/upload"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "justify-start",
                    )}
                  >
                    Upload dataset
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
