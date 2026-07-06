import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiConnectionRecord } from "@/lib/api-connections/provider";
import { GoogleSheetsError } from "@/lib/google-sheets";

const getAccessTokenMock = vi.hoisted(() => vi.fn());
const fetchTabValuesMock = vi.hoisted(() => vi.fn());
const parseValuesMock = vi.hoisted(() => vi.fn());
const assertImportSizeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-sheets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/google-sheets")>(
    "@/lib/google-sheets",
  );

  return {
    ...actual,
    getGoogleSheetsServiceAccountAccessToken: getAccessTokenMock,
    fetchGoogleSheetsTabValues: fetchTabValuesMock,
    parseGoogleSheetsValuesToRows: parseValuesMock,
    assertGoogleSheetsImportSize: assertImportSizeMock,
  };
});

import { googleSheetsProvider } from "./google-sheets";

function googleSheetsConnection() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "google_sheets",
    providerConfig: {
      provider: "google_sheets",
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      spreadsheetTitle: "Mission Sheet",
      sheetId: 1,
      sheetTitle: "Alpha",
      rangeMode: "full_tab",
    },
  } as ApiConnectionRecord;
}

describe("googleSheetsProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAccessTokenMock.mockResolvedValue("service-account-token");
    fetchTabValuesMock.mockResolvedValue([["Name"], ["Alpha"]]);
    parseValuesMock.mockReturnValue({
      columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      rows: [{ name: "Alpha" }],
    });
  });

  it("fetches and parses the configured tab with a service-account token", async () => {
    const log = vi.fn().mockResolvedValue(undefined);

    const result = await googleSheetsProvider.fetch({
      connection: googleSheetsConnection(),
      requestConfig: {
        url: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
        headers: new Headers(),
      },
      secrets: new Map(),
      log,
      onHttpStatus: vi.fn(),
    });

    expect(log).toHaveBeenCalledWith("Fetching Google Sheets tab.");
    expect(getAccessTokenMock).toHaveBeenCalledOnce();
    expect(fetchTabValuesMock).toHaveBeenCalledWith({
      spreadsheetId: "sheet_123",
      sheetTitle: "Alpha",
      accessToken: "service-account-token",
    });
    expect(parseValuesMock).toHaveBeenCalledWith([["Name"], ["Alpha"]]);
    const serializedCsv = assertImportSizeMock.mock.calls[0]?.[0] as string;
    expect(serializedCsv).toContain("Name");
    expect(serializedCsv).toContain("Alpha");
    expect(serializedCsv).not.toContain("service-account-token");
    expect(result).toMatchObject({
      httpStatus: 200,
      parsed: {
        rows: [{ name: "Alpha" }],
      },
    });
    expect(result.body).toContain("Mission Sheet");
    expect(result.body).not.toContain("service-account-token");
  });

  it("propagates service-account access failures before parsing or import sizing", async () => {
    getAccessTokenMock.mockRejectedValue(
      new GoogleSheetsError(
        "Google Sheets service account credentials are not configured.",
        500,
      ),
    );

    await expect(
      googleSheetsProvider.fetch({
        connection: googleSheetsConnection(),
        requestConfig: {
          url: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          headers: new Headers(),
        },
        secrets: new Map(),
        log: vi.fn().mockResolvedValue(undefined),
        onHttpStatus: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message: "Google Sheets service account credentials are not configured.",
      status: 500,
    });

    expect(fetchTabValuesMock).not.toHaveBeenCalled();
    expect(parseValuesMock).not.toHaveBeenCalled();
    expect(assertImportSizeMock).not.toHaveBeenCalled();
  });

  it("propagates parse and size failures before returning importable output", async () => {
    parseValuesMock.mockReturnValueOnce({
      columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      rows: [{ name: "Alpha" }],
    });
    assertImportSizeMock.mockImplementationOnce(() => {
      throw new GoogleSheetsError("Google Sheet import is too large.", 502);
    });

    await expect(
      googleSheetsProvider.fetch({
        connection: googleSheetsConnection(),
        requestConfig: {
          url: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          headers: new Headers(),
        },
        secrets: new Map(),
        log: vi.fn().mockResolvedValue(undefined),
        onHttpStatus: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message: "Google Sheet import is too large.",
      status: 502,
    });
  });
});
