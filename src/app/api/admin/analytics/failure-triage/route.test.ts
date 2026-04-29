import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { upsertAnalyticsFailureTriage } from "@/lib/analytics-store";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/analytics-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics-store")>(
    "@/lib/analytics-store",
  );

  return {
    ...actual,
    upsertAnalyticsFailureTriage: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const upsertAnalyticsFailureTriageMock = vi.mocked(upsertAnalyticsFailureTriage);
const logErrorMock = vi.mocked(logError);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin User",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/analytics/failure-triage", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("/api/admin/analytics/failure-triage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      createRequest({
        fingerprint: "failure|code|route|surface",
        status: "debugging",
        note: "",
      }),
    );

    expect(response.status).toBe(401);
    expect(upsertAnalyticsFailureTriageMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      ownerId: "basic-1",
      email: "basic@example.com",
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      createRequest({
        fingerprint: "failure|code|route|surface",
        status: "debugging",
        note: "",
      }),
    );

    expect(response.status).toBe(403);
    expect(upsertAnalyticsFailureTriageMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await PATCH(
      createRequest({
        fingerprint: "",
        status: "ignored",
        note: "",
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertAnalyticsFailureTriageMock).not.toHaveBeenCalled();
  });

  it("upserts analytics failure triage for admins", async () => {
    const triage = {
      fingerprint: "dataset_rows_failed|row_load_failed|dataset_detail|dataset_table",
      status: "resolved" as const,
      note: "Rows endpoint fixed.",
      triagedByOwnerId: "admin-1",
      triagedAt: "2026-04-22T22:00:00.000Z",
      createdAt: "2026-04-22T22:00:00.000Z",
      updatedAt: "2026-04-22T22:00:00.000Z",
    };
    upsertAnalyticsFailureTriageMock.mockResolvedValue(triage);

    const response = await PATCH(
      createRequest({
        fingerprint: triage.fingerprint,
        status: "resolved",
        note: "Rows endpoint fixed.",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ triage });
    expect(upsertAnalyticsFailureTriageMock).toHaveBeenCalledWith({
      fingerprint: triage.fingerprint,
      status: "resolved",
      note: "Rows endpoint fixed.",
      triagedByOwnerId: "admin-1",
    });
  });

  it("returns a generic error when triage update fails", async () => {
    const error = new Error("db failed");
    upsertAnalyticsFailureTriageMock.mockRejectedValue(error);

    const response = await PATCH(
      createRequest({
        fingerprint: "failure|code|route|surface",
        status: "debugging",
        note: "",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not update analytics failure triage.",
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      "Failed to update analytics failure triage",
      error,
    );
  });
});
