import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_SHEETS_READONLY_SCOPE,
  GoogleSheetsError,
  createGoogleSheetsAuthorizationUrl,
  exchangeGoogleSheetsOAuthCode,
  fetchGoogleSheetsSpreadsheetMetadata,
  fetchGoogleSheetsTabValues,
  parseGoogleSheetUrl,
  parseGoogleSheetsValuesToRows,
} from "@/lib/google-sheets";

const originalClientId = process.env.GOOGLE_SHEETS_OAUTH_CLIENT_ID;
const originalClientSecret = process.env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.GOOGLE_SHEETS_OAUTH_CLIENT_ID = originalClientId;
  process.env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET = originalClientSecret;
});

describe("parseGoogleSheetUrl", () => {
  it("extracts spreadsheet ids and gid values from Google Sheet links", () => {
    const parsed = parseGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/sheet_123/edit#gid=456",
    );

    expect(parsed.spreadsheetId).toBe("sheet_123");
    expect(parsed.gid).toBe(456);
    expect(parsed.spreadsheetUrl).toBe(
      "https://docs.google.com/spreadsheets/d/sheet_123/edit#gid=456",
    );
  });

  it("rejects non-Google spreadsheet URLs before any outbound fetch", () => {
    expect(() => parseGoogleSheetUrl("https://example.com/sheet")).toThrow(
      GoogleSheetsError,
    );
  });
});

describe("createGoogleSheetsAuthorizationUrl", () => {
  it("uses read-only Sheets scope, offline access, and caller state", () => {
    process.env.GOOGLE_SHEETS_OAUTH_CLIENT_ID = "client-id";
    process.env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET = "client-secret";

    const url = new URL(
      createGoogleSheetsAuthorizationUrl({
        redirectUri:
          "https://app.example.com/api/admin/api-connections/google-sheets/oauth/callback",
        state: "state-token",
      }),
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SHEETS_READONLY_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-token");
  });
});

describe("exchangeGoogleSheetsOAuthCode", () => {
  it("returns token details without exposing failed OAuth payload contents", async () => {
    process.env.GOOGLE_SHEETS_OAUTH_CLIENT_ID = "client-id";
    process.env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET = "client-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          scope: GOOGLE_SHEETS_READONLY_SCOPE,
          token_type: "Bearer",
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: "invalid_grant",
            error_description: "secret-refresh-token",
          },
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeGoogleSheetsOAuthCode({
        code: "code",
        redirectUri: "https://app.example.com/callback",
      }),
    ).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      scope: GOOGLE_SHEETS_READONLY_SCOPE,
      tokenType: "Bearer",
      expiresIn: 3600,
    });

    await expect(
      exchangeGoogleSheetsOAuthCode({
        code: "bad-code",
        redirectUri: "https://app.example.com/callback",
      }),
    ).rejects.toThrow("Google OAuth token exchange failed.");
  });
});

describe("fetchGoogleSheetsSpreadsheetMetadata", () => {
  it("normalizes readable spreadsheet tabs in tab order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        properties: { title: "Mission Sheet" },
        sheets: [
          { properties: { sheetId: 20, title: "Second", index: 1 } },
          { properties: { sheetId: 10, title: "First", index: 0 } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await fetchGoogleSheetsSpreadsheetMetadata({
      spreadsheetId: "sheet_123",
      accessToken: "access-token",
    });

    expect(metadata.spreadsheetTitle).toBe("Mission Sheet");
    expect(metadata.sheets.map((sheet) => sheet.title)).toEqual([
      "First",
      "Second",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://sheets.googleapis.com/v4/spreadsheets/sheet_123",
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });
});

describe("fetchGoogleSheetsTabValues", () => {
  it("fetches a full tab range through the fixed Google Sheets values endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        values: [["Name"], ["Alpha"]],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoogleSheetsTabValues({
        spreadsheetId: "sheet_123",
        sheetTitle: "Alpha Tab",
        accessToken: "access-token",
      }),
    ).resolves.toEqual([["Name"], ["Alpha"]]);

    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.origin).toBe("https://sheets.googleapis.com");
    expect(requestedUrl.pathname).toContain("/sheet_123/values/");
    expect(decodeURIComponent(requestedUrl.pathname)).toContain("'Alpha Tab'");
    expect(requestedUrl.searchParams.get("majorDimension")).toBe("ROWS");
  });
});

describe("parseGoogleSheetsValuesToRows", () => {
  it("uses the first non-empty row as headers and skips empty data rows", () => {
    const parsed = parseGoogleSheetsValuesToRows([
      ["", ""],
      ["People Group", "People Group", ""],
      ["Alpha", "A", "ignored"],
      ["", "", ""],
      ["Beta", "", "extra"],
    ]);

    expect(parsed.columns).toEqual([
      { key: "people_group", label: "People Group", sourceIndex: 0 },
      { key: "people_group_2", label: "People Group", sourceIndex: 1 },
      { key: "column_3", label: "Column 3", sourceIndex: 2 },
    ]);
    expect(parsed.rows).toEqual([
      {
        people_group: "Alpha",
        people_group_2: "A",
        column_3: "ignored",
      },
      {
        people_group: "Beta",
        people_group_2: "",
        column_3: "extra",
      },
    ]);
  });

  it("rejects tabs without a header row", () => {
    expect(() => parseGoogleSheetsValuesToRows([[""], []])).toThrow(
      "Google Sheet tab does not include a header row.",
    );
  });
});
