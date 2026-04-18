import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db";
import { analyticsEvents } from "@/db/schema";
import {
  APP_ANALYTICS_EVENT_NAMES,
  APP_ANALYTICS_ROUTES,
  getAnalyticsEventBasePayload,
  getAnalyticsEventProps,
  type AnalyticsWorkspaceRole,
  type AppAnalyticsEventName,
  type AppAnalyticsRoute,
} from "@/lib/analytics";

type StoredAnalyticsValue = string | number | boolean | null;
type AnalyticsSearchParams = Record<string, string | string[] | undefined>;

export type AnalyticsDashboardRange = "7d" | "30d" | "90d";
export type AnalyticsSuccessFilter = "all" | "success" | "failure";

export type StoredAnalyticsEvent = {
  id: string;
  eventName: AppAnalyticsEventName;
  route: AppAnalyticsRoute;
  sourceSurface: string;
  actorOwnerId: string;
  workspaceRole: AnalyticsWorkspaceRole;
  success: boolean;
  errorCode: string | null;
  durationMs: number | null;
  datasetId: string | null;
  savedTableId: string | null;
  targetUserId: string | null;
  eventProps: Record<string, StoredAnalyticsValue>;
  createdAt: string;
};

export type AnalyticsDashboardFilters = {
  range: AnalyticsDashboardRange;
  event: AppAnalyticsEventName | "all";
  route: AppAnalyticsRoute | "all";
  success: AnalyticsSuccessFilter;
  page: number;
  pageSize: number;
  createdAfter: Date;
};

export type AnalyticsSummary = {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueActors: number;
};

export type AnalyticsBreakdownRow = {
  key: string;
  count: number;
};

export type AnalyticsDashboardData = {
  filters: AnalyticsDashboardFilters;
  summary: AnalyticsSummary;
  eventBreakdown: AnalyticsBreakdownRow[];
  routeBreakdown: AnalyticsBreakdownRow[];
  recentFailures: StoredAnalyticsEvent[];
  events: StoredAnalyticsEvent[];
  pageCount: number;
};

const DEFAULT_ANALYTICS_RANGE = "30d" satisfies AnalyticsDashboardRange;
const DEFAULT_ANALYTICS_PAGE_SIZE = 50;
const ANALYTICS_RANGE_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const satisfies Record<AnalyticsDashboardRange, number>;

function getFirstSearchParamValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositivePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function normalizeCount(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value ?? 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStoredAnalyticsEvent(row: typeof analyticsEvents.$inferSelect): StoredAnalyticsEvent {
  return {
    id: row.id,
    eventName: row.eventName as AppAnalyticsEventName,
    route: row.route,
    sourceSurface: row.sourceSurface,
    actorOwnerId: row.actorOwnerId,
    workspaceRole: row.workspaceRole,
    success: row.success,
    errorCode: row.errorCode,
    durationMs: row.durationMs,
    datasetId: row.datasetId,
    savedTableId: row.savedTableId,
    targetUserId: row.targetUserId,
    eventProps: row.eventProps,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildAnalyticsPredicates(
  filters: AnalyticsDashboardFilters,
  input?: {
    ignoreSuccessFilter?: boolean;
    forceFailureOnly?: boolean;
  },
) {
  const predicates: SQL[] = [gte(analyticsEvents.createdAt, filters.createdAfter)];

  if (filters.event !== "all") {
    predicates.push(eq(analyticsEvents.eventName, filters.event));
  }

  if (filters.route !== "all") {
    predicates.push(eq(analyticsEvents.route, filters.route));
  }

  if (input?.forceFailureOnly) {
    predicates.push(eq(analyticsEvents.success, false));
  } else if (!input?.ignoreSuccessFilter) {
    if (filters.success === "success") {
      predicates.push(eq(analyticsEvents.success, true));
    }

    if (filters.success === "failure") {
      predicates.push(eq(analyticsEvents.success, false));
    }
  }

  return and(...predicates);
}

export function createStoredAnalyticsEventRecord(
  name: AppAnalyticsEventName,
  payload: Record<string, unknown>,
) {
  const basePayload = getAnalyticsEventBasePayload(payload);
  const eventProps = getAnalyticsEventProps(name, payload);

  return {
    eventName: name,
    route: basePayload.route as AppAnalyticsRoute,
    sourceSurface: basePayload.source_surface as string,
    actorOwnerId: basePayload.actor_owner_id as string,
    workspaceRole: basePayload.workspace_role as AnalyticsWorkspaceRole,
    success: basePayload.success as boolean,
    errorCode:
      typeof basePayload.error_code === "string" ? basePayload.error_code : null,
    durationMs:
      typeof basePayload.duration_ms === "number"
        ? Math.trunc(basePayload.duration_ms)
        : null,
    datasetId:
      typeof basePayload.dataset_id === "string" ? basePayload.dataset_id : null,
    savedTableId:
      typeof basePayload.saved_table_id === "string"
        ? basePayload.saved_table_id
        : null,
    targetUserId:
      typeof basePayload.target_user_id === "string"
        ? basePayload.target_user_id
        : null,
    eventProps,
  };
}

export async function persistAnalyticsEvent(
  name: AppAnalyticsEventName,
  payload: Record<string, unknown>,
) {
  await getDb().insert(analyticsEvents).values(createStoredAnalyticsEventRecord(name, payload));
}

export function resolveAnalyticsDashboardFilters(
  searchParams: AnalyticsSearchParams,
): AnalyticsDashboardFilters {
  const rangeValue = getFirstSearchParamValue(searchParams.range);
  const eventValue = getFirstSearchParamValue(searchParams.event);
  const routeValue = getFirstSearchParamValue(searchParams.route);
  const successValue = getFirstSearchParamValue(searchParams.success);
  const range =
    rangeValue === "7d" || rangeValue === "30d" || rangeValue === "90d"
      ? rangeValue
      : DEFAULT_ANALYTICS_RANGE;
  const event =
    eventValue === "all" || !eventValue
      ? "all"
      : APP_ANALYTICS_EVENT_NAMES.includes(eventValue as AppAnalyticsEventName)
        ? (eventValue as AppAnalyticsEventName)
        : "all";
  const route =
    routeValue === "all" || !routeValue
      ? "all"
      : APP_ANALYTICS_ROUTES.includes(routeValue as AppAnalyticsRoute)
        ? (routeValue as AppAnalyticsRoute)
        : "all";
  const success =
    successValue === "success" || successValue === "failure"
      ? successValue
      : "all";

  return {
    range,
    event,
    route,
    success,
    page: parsePositivePage(getFirstSearchParamValue(searchParams.page)),
    pageSize: DEFAULT_ANALYTICS_PAGE_SIZE,
    createdAfter: new Date(
      Date.now() - ANALYTICS_RANGE_DAYS[range] * 24 * 60 * 60 * 1000,
    ),
  };
}

export function buildAnalyticsPageHref(
  filters: Pick<AnalyticsDashboardFilters, "range" | "event" | "route" | "success" | "page">,
  overrides: Partial<Pick<AnalyticsDashboardFilters, "range" | "event" | "route" | "success" | "page">> = {},
) {
  const nextFilters = {
    ...filters,
    ...overrides,
  };
  const params = new URLSearchParams();

  params.set("range", nextFilters.range);
  params.set("event", nextFilters.event);
  params.set("route", nextFilters.route);
  params.set("success", nextFilters.success);
  params.set("page", String(nextFilters.page));

  return `/dashboard/analytics?${params.toString()}`;
}

export function formatAnalyticsPayloadPreview(
  eventProps: Record<string, StoredAnalyticsValue>,
) {
  const preview = JSON.stringify(eventProps);

  if (!preview || preview === "{}") {
    return "None";
  }

  return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
}

export async function getAnalyticsDashboardData(
  input: AnalyticsDashboardFilters,
): Promise<AnalyticsDashboardData> {
  const filteredWhereClause = buildAnalyticsPredicates(input);
  const failureWhereClause = buildAnalyticsPredicates(input, {
    ignoreSuccessFilter: true,
    forceFailureOnly: true,
  });
  const eventCountExpression = count();
  const routeCountExpression = count();

  const [summaryRow, eventBreakdownRows, routeBreakdownRows, failureRows] =
    await Promise.all([
      getDb()
        .select({
          totalEvents: count(),
          successfulEvents: sql<number>`coalesce(sum(case when ${analyticsEvents.success} then 1 else 0 end), 0)`,
          failedEvents: sql<number>`coalesce(sum(case when ${analyticsEvents.success} then 0 else 1 end), 0)`,
          uniqueActors: sql<number>`coalesce(count(distinct ${analyticsEvents.actorOwnerId}), 0)`,
        })
        .from(analyticsEvents)
        .where(filteredWhereClause)
        .then((rows) => rows[0] ?? null),
      getDb()
        .select({
          key: analyticsEvents.eventName,
          count: eventCountExpression,
        })
        .from(analyticsEvents)
        .where(filteredWhereClause)
        .groupBy(analyticsEvents.eventName)
        .orderBy(desc(eventCountExpression), asc(analyticsEvents.eventName)),
      getDb()
        .select({
          key: analyticsEvents.route,
          count: routeCountExpression,
        })
        .from(analyticsEvents)
        .where(filteredWhereClause)
        .groupBy(analyticsEvents.route)
        .orderBy(desc(routeCountExpression), asc(analyticsEvents.route)),
      getDb()
        .select()
        .from(analyticsEvents)
        .where(failureWhereClause)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(10),
    ]);

  const summary: AnalyticsSummary = {
    totalEvents: normalizeCount(summaryRow?.totalEvents),
    successfulEvents: normalizeCount(summaryRow?.successfulEvents),
    failedEvents: normalizeCount(summaryRow?.failedEvents),
    uniqueActors: normalizeCount(summaryRow?.uniqueActors),
  };
  const pageCount = Math.max(
    1,
    Math.ceil(summary.totalEvents / DEFAULT_ANALYTICS_PAGE_SIZE),
  );
  const page = Math.min(input.page, pageCount);
  const rows = await getDb()
    .select()
    .from(analyticsEvents)
    .where(filteredWhereClause)
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(DEFAULT_ANALYTICS_PAGE_SIZE)
    .offset((page - 1) * DEFAULT_ANALYTICS_PAGE_SIZE);

  return {
    filters: {
      ...input,
      page,
    },
    summary,
    eventBreakdown: eventBreakdownRows.map((row) => ({
      key: row.key,
      count: normalizeCount(row.count),
    })),
    routeBreakdown: routeBreakdownRows.map((row) => ({
      key: row.key,
      count: normalizeCount(row.count),
    })),
    recentFailures: failureRows.map(toStoredAnalyticsEvent),
    events: rows.map(toStoredAnalyticsEvent),
    pageCount,
  };
}
