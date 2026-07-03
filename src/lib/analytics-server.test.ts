import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackServerAppEvent } from "@/lib/analytics-server";
import { persistAnalyticsEvent } from "@/lib/analytics-store";

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
    persistAnalyticsEventMock.mockResolvedValue(undefined);
  });

  it("persists events to the internal analytics store", async () => {
    await trackServerDashboardViewedEvent();

    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        route: "dashboard",
        dataset_count: 2,
        saved_table_count: 1,
      }),
    );
  });

  it("logs internal persistence failures", async () => {
    const error = new Error("database unavailable");
    persistAnalyticsEventMock.mockRejectedValueOnce(error);

    await trackServerDashboardViewedEvent();

    const { logError } = await import("@/lib/error-logging");
    expect(logError).toHaveBeenCalledWith(
      "Failed to persist server analytics event",
      error,
    );
  });
});
