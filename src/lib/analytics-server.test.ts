import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackServerAppEvent } from "@/lib/analytics-server";
import { persistAnalyticsEvent } from "@/lib/analytics-store";

const { trackMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
}));

vi.mock("@vercel/analytics/server", () => ({
  track: trackMock,
}));

vi.mock("@/lib/analytics-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics-store")>(
    "@/lib/analytics-store",
  );

  return {
    ...actual,
    persistAnalyticsEvent: vi.fn(),
  };
});

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

const persistAnalyticsEventMock = vi.mocked(persistAnalyticsEvent);

function trackServerDashboardViewedEvent() {
  return trackServerAppEvent("dashboard_viewed", {
    route: "dashboard",
    actor_owner_id: "admin-1",
    workspace_role: "admin",
    source_surface: "dashboard_page",
    success: true,
    dataset_count: 2,
    saved_table_count: 1,
  });
}

describe("trackServerAppEvent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    trackMock.mockResolvedValue(undefined);
    persistAnalyticsEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tracks with Vercel and persists internally when analytics is active", async () => {
    await trackServerDashboardViewedEvent();

    expect(trackMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        route: "dashboard",
        dataset_count: 2,
        saved_table_count: 1,
      }),
    );
    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        route: "dashboard",
        dataset_count: 2,
        saved_table_count: 1,
      }),
    );
  });

  it("skips Vercel tracking but still persists internally when analytics is paused", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED", "1");

    await trackServerDashboardViewedEvent();

    expect(trackMock).not.toHaveBeenCalled();
    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        route: "dashboard",
        dataset_count: 2,
        saved_table_count: 1,
      }),
    );
  });
});
