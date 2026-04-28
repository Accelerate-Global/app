import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { logError } from "@/lib/error-logging";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
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

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const persistAnalyticsEventMock = vi.mocked(persistAnalyticsEvent);
const logErrorMock = vi.mocked(logError);

describe("/api/analytics/events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unknown event names", async () => {
    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "unknown_event",
          payload: {
            route: "dashboard",
            actor_owner_id: "owner-1",
            workspace_role: "admin",
            source_surface: "dashboard_page",
            success: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(persistAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("overrides spoofed actor context for authenticated users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "dashboard_viewed",
          payload: {
            route: "dashboard",
            actor_owner_id: "spoofed-user",
            workspace_role: "anonymous",
            source_surface: "dashboard_page",
            success: true,
            dataset_count: 3,
            saved_table_count: 1,
          },
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        actor_owner_id: "admin-1",
        workspace_role: "admin",
      }),
    );
  });

  it("reports basic authenticated users with the canonical role", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "basic-1",
      email: "basic@example.com",
      fullName: "Basic User",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "dashboard_viewed",
          payload: {
            route: "dashboard",
            actor_owner_id: "legacy-viewer",
            workspace_role: "viewer",
            source_surface: "dashboard_page",
            success: true,
            dataset_count: 3,
            saved_table_count: 1,
          },
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        actor_owner_id: "basic-1",
        workspace_role: "basic",
      }),
    );
  });

  it("accepts anonymous auth events with the anonymous context", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "auth_sign_in_failed",
          payload: {
            route: "sign_in",
            actor_owner_id: "anonymous",
            workspace_role: "anonymous",
            source_surface: "auth_form",
            success: false,
            error_code: "invalid_credentials",
          },
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(persistAnalyticsEventMock).toHaveBeenCalledWith(
      "auth_sign_in_failed",
      expect.objectContaining({
        actor_owner_id: "anonymous",
        workspace_role: "anonymous",
      }),
    );
  });

  it("rejects unauthenticated non-anonymous payloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "dashboard_viewed",
          payload: {
            route: "dashboard",
            actor_owner_id: "viewer-1",
            workspace_role: "viewer",
            source_surface: "dashboard_page",
            success: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(persistAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("logs normalized persistence failures", async () => {
    const error = new Error("write failed");
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    persistAnalyticsEventMock.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          name: "dashboard_viewed",
          payload: {
            route: "dashboard",
            actor_owner_id: "spoofed-user",
            workspace_role: "anonymous",
            source_surface: "dashboard_page",
            success: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(logErrorMock).toHaveBeenCalledWith("Failed to persist analytics event", error);
  });
});
