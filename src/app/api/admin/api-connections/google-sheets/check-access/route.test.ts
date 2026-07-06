import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  previewGoogleSheetsConnection,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import {
  GoogleSheetsError,
  getGoogleSheetsServiceAccountEmail,
} from "@/lib/google-sheets";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/google-sheets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/google-sheets")>(
    "@/lib/google-sheets",
  );

  return {
    ...actual,
    getGoogleSheetsServiceAccountEmail: vi.fn(),
  };
});

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ApiConnectionError: actual.ApiConnectionError,
    previewGoogleSheetsConnection: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getGoogleSheetsServiceAccountEmailMock = vi.mocked(
  getGoogleSheetsServiceAccountEmail,
);
const previewGoogleSheetsConnectionMock = vi.mocked(previewGoogleSheetsConnection);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const preview = {
  spreadsheetId: "sheet_123",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
  spreadsheetTitle: "Mission Sheet",
  sheets: [
    { sheetId: 1, title: "Alpha", index: 0 },
    { sheetId: 2, title: "Beta", index: 1 },
  ],
};

describe("/api/admin/api-connections/google-sheets/check-access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    getGoogleSheetsServiceAccountEmailMock.mockReturnValue(
      "sheets@app-project.iam.gserviceaccount.com",
    );
  });

  it("returns service account status for dataset admins", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      configured: true,
      serviceAccountEmail: "sheets@app-project.iam.gserviceaccount.com",
    });
  });

  it("returns unconfigured status without exposing key details", async () => {
    getGoogleSheetsServiceAccountEmailMock.mockImplementation(() => {
      throw new GoogleSheetsError(
        "Google Sheets service account email is not configured.",
        500,
      );
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      configured: false,
      serviceAccountEmail: null,
    });
  });

  it("rejects unauthenticated access checks", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
          }),
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(previewGoogleSheetsConnectionMock).not.toHaveBeenCalled();
  });

  it("checks service-account access for dataset admins", async () => {
    previewGoogleSheetsConnectionMock.mockResolvedValue({
      preview,
      serviceAccountEmail: "sheets@app-project.iam.gserviceaccount.com",
    });

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preview,
      serviceAccountEmail: "sheets@app-project.iam.gserviceaccount.com",
    });
    expect(previewGoogleSheetsConnectionMock).toHaveBeenCalledWith({
      identity,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
    });
  });

  it("returns friendly share instructions for denied Sheets", async () => {
    previewGoogleSheetsConnectionMock.mockRejectedValue(
      new ApiConnectionError(
        "Share this Sheet with sheets@app-project.iam.gserviceaccount.com as Viewer, then check again.",
        403,
      ),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
          }),
        },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Share this Sheet with sheets@app-project.iam.gserviceaccount.com as Viewer, then check again.",
    });
  });

  it("returns invalid-url errors without checking arbitrary hosts", async () => {
    previewGoogleSheetsConnectionMock.mockRejectedValue(
      new GoogleSheetsError("Enter a valid Google Sheet URL."),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          body: JSON.stringify({ spreadsheetUrl: "https://example.com/sheet" }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid Google Sheet URL.",
    });
  });

  it("returns no-readable-tabs errors without creating a connection", async () => {
    previewGoogleSheetsConnectionMock.mockRejectedValue(
      new GoogleSheetsError(
        "Google Sheet does not include any readable tabs.",
      ),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/check-access",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Google Sheet does not include any readable tabs.",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/admin/api-connections/google-sheets/check-access/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
