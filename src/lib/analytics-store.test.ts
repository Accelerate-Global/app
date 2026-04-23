import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import {
  buildAnalyticsFailureFingerprint,
  createStoredAnalyticsEventRecord,
  getAnalyticsDashboardData,
  isActionableAnalyticsFailure,
  resolveAnalyticsFailure,
  resolveAnalyticsDashboardFilters,
} from "@/lib/analytics-store";

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);

function createQueryMock(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    groupBy: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(async () => rows),
    then: (onFulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve(rows).then(onFulfilled),
  };

  return query;
}

describe("analytics-store filters", () => {
  it("defaults to a 30 day range and first page", () => {
    const startedAt = Date.now();
    const filters = resolveAnalyticsDashboardFilters({});
    const ageInDays =
      (startedAt - filters.createdAfter.getTime()) / (24 * 60 * 60 * 1000);

    expect(filters.range).toBe("30d");
    expect(filters.event).toBe("all");
    expect(filters.route).toBe("all");
    expect(filters.success).toBe("all");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(50);
    expect(ageInDays).toBeGreaterThan(29);
    expect(ageInDays).toBeLessThan(31);
  });

  it("normalizes explicit event, route, success, and page filters", () => {
    const filters = resolveAnalyticsDashboardFilters({
      range: "90d",
      event: "sign_out",
      route: "analytics",
      success: "failure",
      page: "2",
    });

    expect(filters.range).toBe("90d");
    expect(filters.event).toBe("sign_out");
    expect(filters.route).toBe("analytics");
    expect(filters.success).toBe("failure");
    expect(filters.page).toBe(2);
  });
});

describe("analytics-store payload shaping", () => {
  it("drops suspicious and untyped event props before persistence", () => {
    const record = createStoredAnalyticsEventRecord("dataset_opened", {
      route: "dashboard",
      actor_owner_id: "owner-1",
      workspace_role: "admin",
      source_surface: "dashboard_page",
      success: true,
      dataset_id: "8a3bade4-d4ac-43be-8fad-cd20412f2cf9",
      dataset_source: "dashboard",
      email: "admin@example.com",
      notes: "secret note",
      query: "should not persist",
      unexpected_key: "drop me",
      nested: { unsafe: true },
    });

    expect(record.eventProps).toEqual({
      dataset_source: "dashboard",
    });
    expect(record.actorOwnerId).toBe("owner-1");
    expect(record.workspaceRole).toBe("admin");
  });

  it("builds stable analytics failure fingerprints", () => {
    expect(
      buildAnalyticsFailureFingerprint({
        eventName: "dataset_upload_failed",
        route: "upload",
        sourceSurface: "dataset_upload",
        errorCode: "authorize_failed",
      }),
    ).toBe("dataset_upload_failed|authorize_failed|upload|dataset_upload");
  });

  it("treats invalid sign-in credentials as non-actionable", () => {
    expect(
      isActionableAnalyticsFailure({
        eventName: "auth_sign_in_failed",
        errorCode: "invalid_credentials",
      }),
    ).toBe(false);
    expect(
      isActionableAnalyticsFailure({
        eventName: "dataset_upload_failed",
        errorCode: "authorize_failed",
      }),
    ).toBe(true);
  });
});

describe("analytics-store failure resolution writes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("upserts the latest analytics failure resolution", async () => {
    const onConflictDoUpdate = vi.fn();
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    getDbMock.mockReturnValue({
      insert,
    } as never);

    await resolveAnalyticsFailure({
      fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
      resolvedByOwnerId: "admin-1",
      resolvedAt: new Date("2026-04-22T22:00:00.000Z"),
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
      resolvedByOwnerId: "admin-1",
      resolvedAt: new Date("2026-04-22T22:00:00.000Z"),
    });
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("analytics-store dashboard queries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps summary counts and paginates event rows", async () => {
    const summaryQuery = createQueryMock([
      {
        totalEvents: "51",
        successfulEvents: "40",
        failedEvents: "11",
        uniqueActors: "8",
      },
    ]);
    const eventBreakdownQuery = createQueryMock([
      { key: "sign_out", count: "22" },
      { key: "dataset_opened", count: "10" },
    ]);
    const routeBreakdownQuery = createQueryMock([
      { key: "dashboard", count: "34" },
      { key: "analytics", count: "17" },
    ]);
    const failureQuery = createQueryMock([
      {
        id: "failure-1",
        eventName: "auth_sign_in_failed",
        route: "sign_in",
        sourceSurface: "auth_form",
        actorOwnerId: "anonymous",
        workspaceRole: "anonymous",
        success: false,
        errorCode: "invalid_credentials",
        durationMs: 120,
        datasetId: null,
        savedTableId: null,
        targetUserId: null,
        eventProps: {},
        createdAt: new Date("2026-04-18T15:00:00.000Z"),
      },
    ]);
    const knownFailuresQuery = createQueryMock([
      {
        fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
        eventName: "dataset_upload_failed",
        route: "upload",
        sourceSurface: "dataset_upload",
        errorCode: "authorize_failed",
        occurrenceCount: "2",
        firstSeenAt: new Date("2026-04-18T15:00:00.000Z"),
        lastSeenAt: new Date("2026-04-18T17:00:00.000Z"),
      },
      {
        fingerprint: "auth_sign_in_failed|invalid_credentials|sign_in|auth_form",
        eventName: "auth_sign_in_failed",
        route: "sign_in",
        sourceSurface: "auth_form",
        errorCode: "invalid_credentials",
        occurrenceCount: "4",
        firstSeenAt: new Date("2026-04-18T14:00:00.000Z"),
        lastSeenAt: new Date("2026-04-18T18:00:00.000Z"),
      },
    ]);
    const knownFailureResolutionsQuery = createQueryMock([
      {
        fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
        resolvedByOwnerId: "admin-1",
        resolvedAt: new Date("2026-04-18T16:00:00.000Z"),
      },
    ]);
    const rowsQuery = createQueryMock([
      {
        id: "event-2",
        eventName: "sign_out",
        route: "analytics",
        sourceSurface: "account_menu",
        actorOwnerId: "owner-2",
        workspaceRole: "admin",
        success: true,
        errorCode: null,
        durationMs: 15,
        datasetId: null,
        savedTableId: null,
        targetUserId: null,
        eventProps: {},
        createdAt: new Date("2026-04-18T16:00:00.000Z"),
      },
    ]);

    getDbMock.mockReturnValue({
      select: vi
        .fn()
        .mockReturnValueOnce(summaryQuery)
        .mockReturnValueOnce(eventBreakdownQuery)
        .mockReturnValueOnce(routeBreakdownQuery)
        .mockReturnValueOnce(failureQuery)
        .mockReturnValueOnce(knownFailuresQuery)
        .mockReturnValueOnce(knownFailureResolutionsQuery)
        .mockReturnValueOnce(rowsQuery),
    } as never);

    const result = await getAnalyticsDashboardData({
      range: "30d",
      event: "all",
      route: "all",
      success: "all",
      page: 2,
      pageSize: 50,
      createdAfter: new Date("2026-03-19T00:00:00.000Z"),
    });

    expect(result.summary).toEqual({
      totalEvents: 51,
      successfulEvents: 40,
      failedEvents: 11,
      uniqueActors: 8,
    });
    expect(result.pageCount).toBe(2);
    expect(result.filters.page).toBe(2);
    expect(result.eventBreakdown).toEqual([
      { key: "sign_out", count: 22 },
      { key: "dataset_opened", count: 10 },
    ]);
    expect(result.routeBreakdown).toEqual([
      { key: "dashboard", count: 34 },
      { key: "analytics", count: 17 },
    ]);
    expect(result.knownFailures).toEqual([
      {
        fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
        eventName: "dataset_upload_failed",
        route: "upload",
        sourceSurface: "dataset_upload",
        errorCode: "authorize_failed",
        occurrenceCount: 2,
        firstSeenAt: "2026-04-18T15:00:00.000Z",
        lastSeenAt: "2026-04-18T17:00:00.000Z",
      },
    ]);
    expect(result.recentFailures[0]?.createdAt).toBe("2026-04-18T15:00:00.000Z");
    expect(result.events[0]?.createdAt).toBe("2026-04-18T16:00:00.000Z");
    expect(rowsQuery.offset).toHaveBeenCalledWith(50);
  });
});
