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
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: null,
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
        },
      ],
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
    expect(screen.getByText("Seen 1 times")).toBeTruthy();
    expect(getAnalyticsDashboardDataMock).toHaveBeenCalled();
  });
});
