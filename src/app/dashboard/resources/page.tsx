import { ChevronLeftIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentIdentity } from "@/lib/auth";
import { cn } from "@/lib/utils";

const builtInResources = [
  {
    id: "country-territory-codes",
    title: "Country & territory code resource",
    description:
      "Search and download shared ISO, GENC, and FIPS country and territory codes.",
    href: "/dashboard/country-codes",
  },
] as const;

export default async function ResourcesPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  return (
    <main
      data-smoke-page="resources"
      data-smoke-page-ready="resources"
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
            <Card key={resource.id}>
              <CardHeader className="gap-2">
                <CardTitle className="text-xl">{resource.title}</CardTitle>
                <CardDescription>{resource.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={resource.href}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Open resource
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
