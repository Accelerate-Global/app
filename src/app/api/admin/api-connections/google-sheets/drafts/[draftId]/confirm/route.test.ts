import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  confirmGoogleSheetsConnectionDraft,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ApiConnectionError: actual.ApiConnectionError,
    confirmGoogleSheetsConnectionDraft: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const confirmGoogleSheetsConnectionDraftMock = vi.mocked(
  confirmGoogleSheetsConnectionDraft,
);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({ draftId: "draft-1" }),
};

const connection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Mission Sheet - Alpha",
  description: "Private Google Sheets tab.",
  method: "GET" as const,
  url: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
  headers: [],
  bodyTemplate: "",
  responseFormat: "csv" as const,
  responseDataPath: "",
  importMode: "create" as const,
  targetDatasetId: null,
  datasetName: "Mission-Sheet-Alpha.csv",
  datasetClassification: "PGAC" as const,
  provider: "google_sheets" as const,
  providerConfig: {
    provider: "google_sheets" as const,
    spreadsheetId: "sheet_123",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    spreadsheetTitle: "Mission Sheet",
    sheetId: 1,
    sheetTitle: "Alpha",
    rangeMode: "full_tab" as const,
  },
  createdAt: "2026-05-09T07:45:00.000Z",
  updatedAt: "2026-05-09T07:45:00.000Z",
};

describe("/api/admin/api-connections/google-sheets/drafts/[draftId]/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects non-admin confirmation requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          selectedSheetIds: [1],
          datasetClassification: "PGAC",
        }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(confirmGoogleSheetsConnectionDraftMock).not.toHaveBeenCalled();
  });

  it("creates one connection per selected tab", async () => {
    confirmGoogleSheetsConnectionDraftMock.mockResolvedValue([connection]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          selectedSheetIds: [1],
          datasetClassification: "PGAC",
        }),
      }),
      context,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ connections: [connection] });
    expect(confirmGoogleSheetsConnectionDraftMock).toHaveBeenCalledWith({
      identity,
      draftId: "draft-1",
      selectedSheetIds: [1],
      datasetClassification: "PGAC",
    });
  });

  it("returns domain errors without creating connections", async () => {
    confirmGoogleSheetsConnectionDraftMock.mockRejectedValue(
      new ApiConnectionError("Choose at least one valid Google Sheet tab."),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          selectedSheetIds: [99],
          datasetClassification: "PGAC",
        }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose at least one valid Google Sheet tab.",
    });
  });
});
