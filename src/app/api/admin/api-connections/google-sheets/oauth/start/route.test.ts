import { beforeEach, describe, expect, it, vi } from "vitest";

import { startGoogleSheetsConnectionOAuth } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  startGoogleSheetsConnectionOAuth: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const startGoogleSheetsConnectionOAuthMock = vi.mocked(
  startGoogleSheetsConnectionOAuth,
);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/api-connections/google-sheets/oauth/start", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated start requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/api-connections/google-sheets/oauth/start", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(startGoogleSheetsConnectionOAuthMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin start requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/api-connections/google-sheets/oauth/start", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(startGoogleSheetsConnectionOAuthMock).not.toHaveBeenCalled();
  });

  it("starts OAuth for dataset admins", async () => {
    startGoogleSheetsConnectionOAuthMock.mockResolvedValue({
      draftId: "draft-1",
      authorizationUrl: "https://accounts.google.com/oauth",
    });

    const request = new Request(
      "http://localhost/api/admin/api-connections/google-sheets/oauth/start",
      {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
        }),
      },
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl: "https://accounts.google.com/oauth",
    });
    expect(startGoogleSheetsConnectionOAuthMock).toHaveBeenCalledWith({
      identity,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
      requestUrl: request.url,
    });
  });

  it("returns validation errors without creating a draft", async () => {
    startGoogleSheetsConnectionOAuthMock.mockRejectedValue(
      new GoogleSheetsError("Enter a valid Google Sheet URL."),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/api-connections/google-sheets/oauth/start", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://example.com/sheet",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid Google Sheet URL.",
    });
  });
});
