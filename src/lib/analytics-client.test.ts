import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackAppEvent } from "@/lib/analytics-client";
import { logError } from "@/lib/error-logging";

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

const fetchMock = vi.fn();
const sendBeaconMock = vi.fn(() => false);
const logErrorMock = vi.mocked(logError);

function trackDashboardViewedEvent() {
  trackAppEvent("dashboard_viewed", {
    route: "dashboard",
    actor_owner_id: "admin-1",
    workspace_role: "admin",
    source_surface: "dashboard_page",
    success: true,
    dataset_count: 2,
    saved_table_count: 1,
  });
}

describe("trackAppEvent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists events to the internal analytics endpoint", () => {
    trackDashboardViewedEvent();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });

  it("uses sendBeacon when the browser accepts the event", () => {
    sendBeaconMock.mockReturnValueOnce(true);

    trackDashboardViewedEvent();

    expect(sendBeaconMock).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.any(Blob),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
