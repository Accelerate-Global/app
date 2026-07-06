import { afterEach, describe, expect, it, vi } from "vitest";

const getAccessTokenMock = vi.hoisted(() => vi.fn());
const jwtConstructorMock = vi.hoisted(() =>
  vi.fn(function MockJwt(this: { getAccessToken: typeof getAccessTokenMock }) {
    this.getAccessToken = getAccessTokenMock;
  }),
);

vi.mock("google-auth-library", () => ({
  JWT: jwtConstructorMock,
}));

import {
  GOOGLE_SHEETS_READONLY_SCOPE,
  GoogleSheetsError,
  assertGoogleSheetsImportSize,
  fetchGoogleSheetsSpreadsheetMetadata,
  fetchGoogleSheetsTabValues,
  getGoogleSheetsServiceAccountAccessToken,
  getGoogleSheetsServiceAccountConfig,
  getGoogleSheetsServiceAccountEmail,
  parseGoogleSheetUrl,
  parseGoogleSheetsValuesToRows,
} from "@/lib/google-sheets";

const originalServiceAccountEmail =
  process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
const originalServiceAccountPrivateKey =
  process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
    originalServiceAccountEmail;
  process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY =
    originalServiceAccountPrivateKey;
});

describe("Google Sheets service account configuration", () => {
  it("returns the configured service account email", () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
      "sheets@app-project.iam.gserviceaccount.com";

    expect(getGoogleSheetsServiceAccountEmail()).toBe(
      "sheets@app-project.iam.gserviceaccount.com",
    );
  });

  it("normalizes escaped private-key newlines", () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
      "sheets@app-project.iam.gserviceaccount.com";
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";

    expect(getGoogleSheetsServiceAccountConfig()).toEqual({
      email: "sheets@app-project.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    });
  });

  it("throws clear configuration errors without exposing private-key contents", () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL = "";
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY = "secret-key";

    expect(() => getGoogleSheetsServiceAccountConfig()).toThrow(
      "Google Sheets service account email is not configured.",
    );

    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
      "sheets@app-project.iam.gserviceaccount.com";
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY = "";

    expect(() => getGoogleSheetsServiceAccountConfig()).toThrow(
      "Google Sheets service account credentials are not configured.",
    );
  });

  it("mints readonly access tokens through the official auth library", async () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
      "sheets@app-project.iam.gserviceaccount.com";
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";
    getAccessTokenMock.mockResolvedValue({ token: "access-token" });

    await expect(getGoogleSheetsServiceAccountAccessToken()).resolves.toBe(
      "access-token",
    );
    expect(jwtConstructorMock).toHaveBeenCalledWith({
      email: "sheets@app-project.iam.gserviceaccount.com",
      key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      scopes: [GOOGLE_SHEETS_READONLY_SCOPE],
    });
  });

  it("redacts auth-library failures behind a stable configuration error", async () => {
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL =
      "sheets@app-project.iam.gserviceaccount.com";
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY = "secret-private-key";
    getAccessTokenMock.mockRejectedValue(
      new Error("secret-private-key is malformed"),
    );

    await expect(getGoogleSheetsServiceAccountAccessToken()).rejects.toThrow(
      "Google Sheets service account credentials are invalid.",
    );
  });
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

  it("reports service-account access failures without provider payload details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            message: "The caller secret-token does not have permission.",
          },
        },
        { status: 403 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGoogleSheetsSpreadsheetMetadata({
        spreadsheetId: "sheet_123",
        accessToken: "access-token",
      }),
    ).rejects.toMatchObject({
      message: "Google Sheet is not shared with the service account.",
      status: 403,
    });
  });

  it("reports spreadsheets with no readable tabs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ sheets: [] })));

    await expect(
      fetchGoogleSheetsSpreadsheetMetadata({
        spreadsheetId: "sheet_123",
        accessToken: "access-token",
      }),
    ).rejects.toThrow("Google Sheet does not include any readable tabs.");
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

  it("reports unreadable selected tabs as service-account access failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { message: "secret-token cannot read this tab." } },
          { status: 403 },
        ),
      ),
    );

    await expect(
      fetchGoogleSheetsTabValues({
        spreadsheetId: "sheet_123",
        sheetTitle: "Alpha Tab",
        accessToken: "access-token",
      }),
    ).rejects.toMatchObject({
      message: "Google Sheet tab is not readable by the service account.",
      status: 403,
    });
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

  it("rejects oversized imports before dataset replacement", () => {
    expect(() => assertGoogleSheetsImportSize("small,csv")).not.toThrow();
    expect(() =>
      assertGoogleSheetsImportSize("x".repeat(25 * 1024 * 1024 + 1)),
    ).toThrow("Google Sheet import is too large.");
  });
});
