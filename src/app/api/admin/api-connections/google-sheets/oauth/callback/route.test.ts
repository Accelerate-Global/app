import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  completeGoogleSheetsConnectionOAuth,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ApiConnectionError: actual.ApiConnectionError,
    completeGoogleSheetsConnectionOAuth: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const completeGoogleSheetsConnectionOAuthMock = vi.mocked(
  completeGoogleSheetsConnectionOAuth,
);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

function expectRedirect(response: Response, expectedSearch: string) {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(
    `http://localhost/dashboard/api-connections${expectedSearch}`,
  );
}

describe("/api/admin/api-connections/google-sheets/oauth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("redirects unauthorized callbacks without completing OAuth", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/oauth/callback?code=code&state=state",
      ),
    );

    expectRedirect(response, "?googleSheetError=unauthorized");
    expect(completeGoogleSheetsConnectionOAuthMock).not.toHaveBeenCalled();
  });

  it("completes OAuth and redirects back to the draft selector", async () => {
    completeGoogleSheetsConnectionOAuthMock.mockResolvedValue({
      id: "draft-1",
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      spreadsheetTitle: "Mission Sheet",
      sheets: [],
      expiresAt: "2026-05-09T08:00:00.000Z",
      createdAt: "2026-05-09T07:45:00.000Z",
      updatedAt: "2026-05-09T07:45:00.000Z",
    });
    const request = new Request(
      "http://localhost/api/admin/api-connections/google-sheets/oauth/callback?code=code&state=state",
    );

    const response = await GET(request);

    expectRedirect(response, "?googleSheetDraft=draft-1");
    expect(completeGoogleSheetsConnectionOAuthMock).toHaveBeenCalledWith({
      identity,
      code: "code",
      state: "state",
      requestUrl: request.url,
    });
  });

  it("redirects failed callbacks without exposing provider error details", async () => {
    completeGoogleSheetsConnectionOAuthMock.mockRejectedValue(
      new ApiConnectionError("Google did not return a refresh token."),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/oauth/callback?code=code&state=state",
      ),
    );

    expectRedirect(response, "?googleSheetError=oauth_callback_failed");
  });
});
