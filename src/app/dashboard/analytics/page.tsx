import { ActivityIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ANALYTICS_EVENT_NAMES, APP_ANALYTICS_ROUTES } from "@/lib/analytics";
import {
  ANALYTICS_FAILURE_TRIAGE_STATUS_LABELS,
  type AnalyticsFailureTriageStatus,
} from "@/lib/analytics-failure-triage";
import { getCurrentIdentity } from "@/lib/auth";
import {
  buildAnalyticsPageHref,
  formatAnalyticsPayloadPreview,
  getAnalyticsDashboardData,
  type KnownAnalyticsFailure,
  resolveAnalyticsDashboardFilters,
} from "@/lib/analytics-store";
import { cn } from "@/lib/utils";
import { FailureTriageControls } from "./failure-triage-controls";

type AnalyticsPageProps = {
  searchParams: Promise<{
    range?: string | string[];
    event?: string | string[];
    route?: string | string[];
    success?: string | string[];
    page?: string | string[];
  }>;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCodeLabel(value: string) {
  return value
    .split("_")
    .map((segment) =>
      segment.length === 0 ? segment : `${segment[0]!.toUpperCase()}${segment.slice(1)}`,
    )
    .join(" ");
}

function getEventEntityLabel(input: {
  datasetId: string | null;
  savedTableId: string | null;
  targetUserId: string | null;
}) {
  if (input.datasetId) {
    return `Dataset ${input.datasetId}`;
  }

  if (input.savedTableId) {
    return `Saved table ${input.savedTableId}`;
  }

  if (input.targetUserId) {
    return `User ${input.targetUserId}`;
  }

  return "None";
}

function getFailureStatusBadgeVariant(
  status: AnalyticsFailureTriageStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "needs_review") {
    return "destructive";
  }

  if (status === "debugging") {
    return "secondary";
  }

  if (status === "expected") {
    return "outline";
  }

  return "default";
}

function FailureGroupList({
  failures,
  emptyMessage,
  showControls = true,
}: {
  failures: KnownAnalyticsFailure[];
  emptyMessage: string;
  showControls?: boolean;
}) {
  if (failures.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {failures.map((failure) => (
        <li
          key={failure.fingerprint}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            failure.status === "needs_review"
              ? "border-destructive/30 bg-destructive/5"
              : "border-border",
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-foreground">
                {failure.eventName}
              </span>
              <Badge variant={getFailureStatusBadgeVariant(failure.status)}>
                {ANALYTICS_FAILURE_TRIAGE_STATUS_LABELS[failure.status]}
              </Badge>
              {failure.reopened ? (
                <Badge variant="destructive">New since resolved</Badge>
              ) : null}
              {failure.isBuiltInExpected ? (
                <Badge variant="outline">Built-in expected</Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground">
              Last seen {formatTimestamp(failure.lastSeenAt)}
            </div>
          </div>
          <div className="mt-1 text-muted-foreground">
            {failure.errorCode ?? "No error code"} · {formatCodeLabel(failure.route)} ·{" "}
            {failure.sourceSurface}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Seen {formatCount(failure.occurrenceCount)} times</span>
            <span>First seen {formatTimestamp(failure.firstSeenAt)}</span>
            {failure.triagedAt ? (
              <span>Triaged {formatTimestamp(failure.triagedAt)}</span>
            ) : null}
            {failure.triagedByOwnerId ? (
              <span className="font-mono">By {failure.triagedByOwnerId}</span>
            ) : null}
          </div>
          {failure.note ? (
            <p className="mt-2 text-sm text-foreground">{failure.note}</p>
          ) : null}
          {showControls && !failure.isBuiltInExpected ? (
            <FailureTriageControls
              fingerprint={failure.fingerprint}
              status={failure.status}
              note={failure.note}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  if (!identity.isDatasetAdmin) {
    redirect("/dashboard");
  }

  const filters = resolveAnalyticsDashboardFilters(await searchParams);
  const data = await getAnalyticsDashboardData(filters);
  const baseHrefFilters = {
    range: data.filters.range,
    event: data.filters.event,
    route: data.filters.route,
    success: data.filters.success,
    page: data.filters.page,
  } as const;

  return (
    <main
      data-smoke-page="analytics"
      data-smoke-page-ready="analytics"
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
              <ActivityIcon className="size-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
                Analytics
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                Review event volume, open known failures, and recent product activity
                from the app&apos;s internal analytics store.
              </p>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="GET" className="grid gap-4 md:grid-cols-5">
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Range</span>
                <select
                  name="range"
                  defaultValue={data.filters.range}
                  className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Event</span>
                <select
                  name="event"
                  defaultValue={data.filters.event}
                  className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All events</option>
                  {APP_ANALYTICS_EVENT_NAMES.map((eventName) => (
                    <option key={eventName} value={eventName}>
                      {eventName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Route</span>
                <select
                  name="route"
                  defaultValue={data.filters.route}
                  className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All routes</option>
                  {APP_ANALYTICS_ROUTES.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                <span>Result</span>
                <select
                  name="success"
                  defaultValue={data.filters.success}
                  className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All results</option>
                  <option value="success">Success only</option>
                  <option value="failure">Failure only</option>
                </select>
              </label>
              <div className="flex items-end">
                <input type="hidden" name="page" value="1" />
                <button
                  type="submit"
                  className={cn(buttonVariants({ variant: "default" }), "w-full")}
                >
                  Apply filters
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total events</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatCount(data.summary.totalEvents)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Successful events</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatCount(data.summary.successfulEvents)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Failed events logged</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-destructive">
              {formatCount(data.summary.failedEvents)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open failure groups</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-destructive">
              {formatCount(data.summary.openFailureGroups)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expected groups</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatCount(data.summary.expectedFailureGroups)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolved groups</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatCount(data.summary.resolvedFailureGroups)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unique actors</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {formatCount(data.summary.uniqueActors)}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Events by name</CardTitle>
            </CardHeader>
            <CardContent>
              {data.eventBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching events yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 font-medium">Event</th>
                        <th className="py-2 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.eventBreakdown.map((row) => (
                        <tr key={row.key} className="border-b border-border/60">
                          <td className="py-2 font-mono text-xs">{row.key}</td>
                          <td className="py-2">{formatCount(row.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Events by route</CardTitle>
            </CardHeader>
            <CardContent>
              {data.routeBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching routes yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 font-medium">Route</th>
                        <th className="py-2 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.routeBreakdown.map((row) => (
                        <tr key={row.key} className="border-b border-border/60">
                          <td className="py-2">{formatCodeLabel(row.key)}</td>
                          <td className="py-2">{formatCount(row.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Known failures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Open known failures are actionable grouped fingerprints that need
                review or are actively being debugged.
              </p>
              {data.summary.failedEvents > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Raw failed events remain in recent history even when their group is
                  expected or resolved.
                </p>
              ) : null}
            </div>
            <FailureGroupList
              failures={data.knownFailures}
              emptyMessage="No open known failures for this range."
            />
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Expected failure groups</CardTitle>
            </CardHeader>
            <CardContent>
              <FailureGroupList
                failures={data.expectedFailures}
                emptyMessage="No expected failure groups in this range."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resolved failure groups</CardTitle>
            </CardHeader>
            <CardContent>
              <FailureGroupList
                failures={data.resolvedFailures}
                emptyMessage="No resolved failure groups in this range."
              />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 font-medium">Timestamp</th>
                    <th className="py-2 font-medium">Event</th>
                    <th className="py-2 font-medium">Route</th>
                    <th className="py-2 font-medium">Source</th>
                    <th className="py-2 font-medium">Role</th>
                    <th className="py-2 font-medium">Result</th>
                    <th className="py-2 font-medium">Actor</th>
                    <th className="py-2 font-medium">Entity</th>
                    <th className="py-2 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-muted-foreground">
                        No analytics events match the current filters.
                      </td>
                    </tr>
                  ) : (
                    data.events.map((event) => (
                      <tr
                        key={event.id}
                        className={cn(
                          "border-b border-border/60 align-top",
                          event.success ? "" : "bg-destructive/5",
                        )}
                      >
                        <td className="py-2">{formatTimestamp(event.createdAt)}</td>
                        <td className="py-2 font-mono text-xs">{event.eventName}</td>
                        <td className="py-2">{formatCodeLabel(event.route)}</td>
                        <td className="py-2">{event.sourceSurface}</td>
                        <td className="py-2">{event.workspaceRole}</td>
                        <td
                          className={cn(
                            "py-2 font-medium",
                            event.success ? "text-foreground" : "text-destructive",
                          )}
                        >
                          {event.success ? "Success" : "Failure"}
                        </td>
                        <td className="py-2 font-mono text-xs">{event.actorOwnerId}</td>
                        <td className="py-2 font-mono text-xs">
                          {getEventEntityLabel(event)}
                        </td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {formatAnalyticsPayloadPreview(event.eventProps)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data.filters.page} of {data.pageCount}
              </p>
              <div className="flex gap-2">
                <Link
                  href={buildAnalyticsPageHref(baseHrefFilters, {
                    page: Math.max(1, data.filters.page - 1),
                  })}
                  aria-disabled={data.filters.page <= 1}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    data.filters.page <= 1 ? "pointer-events-none opacity-50" : "",
                  )}
                >
                  Previous
                </Link>
                <Link
                  href={buildAnalyticsPageHref(baseHrefFilters, {
                    page: Math.min(data.pageCount, data.filters.page + 1),
                  })}
                  aria-disabled={data.filters.page >= data.pageCount}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    data.filters.page >= data.pageCount
                      ? "pointer-events-none opacity-50"
                      : "",
                  )}
                >
                  Next
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
