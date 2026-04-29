import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import {
  buildAnalyticsFailureFingerprint,
  createStoredAnalyticsEventRecord,
  getAnalyticsDashboardData,
  isActionableAnalyticsFailure,
  resolveAnalyticsFailure,
  resolveAnalyticsDashboardFilters,
  upsertAnalyticsFailureTriage,
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

describe("analytics-store failure triage writes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("upserts the latest analytics failure triage", async () => {
    const onConflictDoUpdate = vi.fn();
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    getDbMock.mockReturnValue({
      insert,
    } as never);

    const result = await upsertAnalyticsFailureTriage({
      fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
      status: "debugging",
      note: "Investigating dataset upload authorization.",
      triagedByOwnerId: "admin-1",
      triagedAt: new Date("2026-04-22T22:00:00.000Z"),
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
      status: "debugging",
      note: "Investigating dataset upload authorization.",
      triagedByOwnerId: "admin-1",
      triagedAt: new Date("2026-04-22T22:00:00.000Z"),
      updatedAt: new Date("2026-04-22T22:00:00.000Z"),
    });
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("debugging");
  });

  it("keeps legacy resolution helper mapped to resolved triage", async () => {
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

    expect(values).toHaveBeenCalledWith({
      fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
      status: "resolved",
      note: "",
      triagedByOwnerId: "admin-1",
      triagedAt: new Date("2026-04-22T22:00:00.000Z"),
      updatedAt: new Date("2026-04-22T22:00:00.000Z"),
    });
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
      {
        fingerprint: "dataset_rows_failed|row_load_failed|dataset_detail|dataset_table",
        eventName: "dataset_rows_failed",
        route: "dataset_detail",
        sourceSurface: "dataset_table",
        errorCode: "row_load_failed",
        occurrenceCount: "1",
        firstSeenAt: new Date("2026-04-18T15:30:00.000Z"),
        lastSeenAt: new Date("2026-04-18T15:30:00.000Z"),
      },
      {
        fingerprint: "dataset_preload_failed|preload_failed|dashboard|dashboard_page",
        eventName: "dataset_preload_failed",
        route: "dashboard",
        sourceSurface: "dashboard_page",
        errorCode: "preload_failed",
        occurrenceCount: "3",
        firstSeenAt: new Date("2026-04-18T13:00:00.000Z"),
        lastSeenAt: new Date("2026-04-18T14:30:00.000Z"),
      },
    ]);
    const knownFailureTriageQuery = createQueryMock([
      {
        fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
        status: "resolved",
        note: "Deploy shipped.",
        triagedByOwnerId: "admin-1",
        triagedAt: new Date("2026-04-18T16:00:00.000Z"),
        createdAt: new Date("2026-04-18T16:00:00.000Z"),
        updatedAt: new Date("2026-04-18T16:00:00.000Z"),
      },
      {
        fingerprint: "dataset_rows_failed|row_load_failed|dataset_detail|dataset_table",
        status: "resolved",
        note: "Rows endpoint fixed.",
        triagedByOwnerId: "admin-1",
        triagedAt: new Date("2026-04-18T16:00:00.000Z"),
        createdAt: new Date("2026-04-18T16:00:00.000Z"),
        updatedAt: new Date("2026-04-18T16:00:00.000Z"),
      },
      {
        fingerprint: "dataset_preload_failed|preload_failed|dashboard|dashboard_page",
        status: "expected",
        note: "Known empty local preload.",
        triagedByOwnerId: "admin-2",
        triagedAt: new Date("2026-04-18T15:00:00.000Z"),
        createdAt: new Date("2026-04-18T15:00:00.000Z"),
        updatedAt: new Date("2026-04-18T15:00:00.000Z"),
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
        .mockReturnValueOnce(knownFailureTriageQuery)
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
      openFailureGroups: 1,
      expectedFailureGroups: 2,
      resolvedFailureGroups: 1,
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
        status: "needs_review",
        note: "Deploy shipped.",
        triagedByOwnerId: "admin-1",
        triagedAt: "2026-04-18T16:00:00.000Z",
        isBuiltInExpected: false,
        reopened: true,
      },
    ]);
    expect(result.expectedFailures.map((failure) => failure.fingerprint)).toEqual([
      "auth_sign_in_failed|invalid_credentials|sign_in|auth_form",
      "dataset_preload_failed|preload_failed|dashboard|dashboard_page",
    ]);
    expect(result.resolvedFailures[0]?.fingerprint).toBe(
      "dataset_rows_failed|row_load_failed|dataset_detail|dataset_table",
    );
    expect(result.recentFailures[0]?.createdAt).toBe("2026-04-18T15:00:00.000Z");
    expect(result.events[0]?.createdAt).toBe("2026-04-18T16:00:00.000Z");
    expect(rowsQuery.offset).toHaveBeenCalledWith(50);
  });
});
