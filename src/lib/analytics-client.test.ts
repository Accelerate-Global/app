import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackAppEvent } from "@/lib/analytics-client";
import { logError } from "@/lib/error-logging";

const { trackMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
}));

vi.mock("@vercel/analytics", () => ({
  track: trackMock,
}));

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
    vi.unstubAllEnvs();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("tracks with Vercel and persists internally when analytics is active", () => {
    trackDashboardViewedEvent();

    expect(trackMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        route: "dashboard",
        dataset_count: 2,
        saved_table_count: 1,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });

  it("skips Vercel tracking but still persists internally when analytics is paused", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED", "1");

    trackDashboardViewedEvent();

    expect(trackMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
