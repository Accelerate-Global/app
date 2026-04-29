// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import {
  getAnalyticsDashboardData,
  resolveAnalyticsDashboardFilters,
} from "@/lib/analytics-store";
import AnalyticsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/analytics-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics-store")>(
    "@/lib/analytics-store",
  );

  return {
    ...actual,
    getAnalyticsDashboardData: vi.fn(),
    resolveAnalyticsDashboardFilters: vi.fn(),
  };
});

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getAnalyticsDashboardDataMock = vi.mocked(getAnalyticsDashboardData);
const resolveAnalyticsDashboardFiltersMock = vi.mocked(resolveAnalyticsDashboardFilters);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/analytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(
      AnalyticsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin users back to the dashboard", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "basic-1",
      email: "basic@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(
      AnalyticsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders analytics data for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    resolveAnalyticsDashboardFiltersMock.mockReturnValue({
      range: "30d",
      event: "all",
      route: "all",
      success: "all",
      page: 1,
      pageSize: 50,
      createdAfter: new Date("2026-03-19T00:00:00.000Z"),
    });
    getAnalyticsDashboardDataMock.mockResolvedValue({
      filters: {
        range: "30d",
        event: "all",
        route: "all",
        success: "all",
        page: 1,
        pageSize: 50,
        createdAfter: new Date("2026-03-19T00:00:00.000Z"),
      },
      summary: {
        totalEvents: 12,
        successfulEvents: 10,
        failedEvents: 2,
        openFailureGroups: 1,
        expectedFailureGroups: 1,
        resolvedFailureGroups: 0,
        uniqueActors: 4,
      },
      eventBreakdown: [{ key: "sign_out", count: 6 }],
      routeBreakdown: [{ key: "analytics", count: 12 }],
      knownFailures: [
        {
          fingerprint: "dataset_upload_failed|authorize_failed|upload|dataset_upload",
          eventName: "dataset_upload_failed",
          route: "upload",
          sourceSurface: "dataset_upload",
          errorCode: "authorize_failed",
          occurrenceCount: 1,
          firstSeenAt: "2026-04-18T15:00:00.000Z",
          lastSeenAt: "2026-04-18T15:00:00.000Z",
          status: "needs_review",
          note: "",
          triagedByOwnerId: null,
          triagedAt: null,
          isBuiltInExpected: false,
          reopened: false,
        },
      ],
      expectedFailures: [
        {
          fingerprint: "auth_sign_in_failed|invalid_credentials|sign_in|auth_form",
          eventName: "auth_sign_in_failed",
          route: "sign_in",
          sourceSurface: "auth_form",
          errorCode: "invalid_credentials",
          occurrenceCount: 1,
          firstSeenAt: "2026-04-18T14:00:00.000Z",
          lastSeenAt: "2026-04-18T14:00:00.000Z",
          status: "expected",
          note: "",
          triagedByOwnerId: null,
          triagedAt: null,
          isBuiltInExpected: true,
          reopened: false,
        },
      ],
      resolvedFailures: [],
      recentFailures: [],
      events: [],
      pageCount: 1,
    });

    render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Analytics" }),
    ).toBeTruthy();
    expect(screen.queryByText("Forward-only history")).toBeNull();
    expect(screen.getByText("Total events")).toBeTruthy();
    expect(screen.getByText("Unique actors")).toBeTruthy();
    expect(screen.getByText("Known failures")).toBeTruthy();
    expect(screen.getByText("Open failure groups")).toBeTruthy();
    expect(screen.getByText("Expected failure groups")).toBeTruthy();
    expect(screen.getAllByText("Seen 1 times").length).toBeGreaterThan(0);
    expect(getAnalyticsDashboardDataMock).toHaveBeenCalled();
  });
});
