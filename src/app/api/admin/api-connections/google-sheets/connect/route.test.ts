import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  createGoogleSheetsConnections,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GoogleSheetsError } from "@/lib/google-sheets";
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
    createGoogleSheetsConnections: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createGoogleSheetsConnectionsMock = vi.mocked(createGoogleSheetsConnections);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
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

const alphaHeaderSelection = {
  sheetId: 1,
  mode: "auto" as const,
  startRow: 4,
  endRow: 4,
};

describe("/api/admin/api-connections/google-sheets/connect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects non-admin connection requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1],
            headerSelections: [alphaHeaderSelection],
            datasetClassification: "PGAC",
          }),
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(createGoogleSheetsConnectionsMock).not.toHaveBeenCalled();
  });

  it("creates one connection per selected tab", async () => {
    const secondConnection = {
      ...connection,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Mission Sheet - Beta",
      datasetName: "Mission-Sheet-Beta.csv",
      providerConfig: {
        ...connection.providerConfig,
        sheetId: 2,
        sheetTitle: "Beta",
      },
    };
    createGoogleSheetsConnectionsMock.mockResolvedValue([
      connection,
      secondConnection,
    ]);

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1, 2],
            headerSelections: [
              alphaHeaderSelection,
              { sheetId: 2, mode: "manual", startRow: 2, endRow: 3 },
            ],
            datasetSettings: [
              { sheetId: 1, datasetName: "Reviewed Alpha" },
              { sheetId: 2, datasetName: "Reviewed Beta" },
            ],
            datasetClassification: "PGAC",
            isWorkspaceVisible: false,
          }),
        },
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      connections: [connection, secondConnection],
    });
    expect(createGoogleSheetsConnectionsMock).toHaveBeenCalledWith({
      identity,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
      selectedSheetIds: [1, 2],
      headerSelections: [
        alphaHeaderSelection,
        { sheetId: 2, mode: "manual", startRow: 2, endRow: 3 },
      ],
      datasetSettings: [
        { sheetId: 1, datasetName: "Reviewed Alpha" },
        { sheetId: 2, datasetName: "Reviewed Beta" },
      ],
      datasetClassification: "PGAC",
      isWorkspaceVisible: false,
      workflowAssignments: [],
    });
  });

  it("defaults omitted dataset visibility to workspace-visible", async () => {
    createGoogleSheetsConnectionsMock.mockResolvedValue([connection]);

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1],
            headerSelections: [alphaHeaderSelection],
            datasetClassification: "PGAC",
          }),
        },
      ),
    );

    expect(response.status).toBe(201);
    expect(createGoogleSheetsConnectionsMock).toHaveBeenCalledWith({
      identity,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
      selectedSheetIds: [1],
      headerSelections: [alphaHeaderSelection],
      datasetSettings: undefined,
      datasetClassification: "PGAC",
      isWorkspaceVisible: true,
      workflowAssignments: [],
    });
  });

  it("passes reviewed workflow assignments to connection creation", async () => {
    createGoogleSheetsConnectionsMock.mockResolvedValue([connection]);
    const workflowAssignment = {
      sheetId: 1,
      kind: "tier2" as const,
      ownerKey: "ax",
      feedKey: "final-58",
      feedName: "Final-58",
      stableRowKeyColumn: "Engagement ID",
      trackingIdColumn: "PeopleID3",
      trackingIdSource: "peopleid3" as const,
      trackingIdSourceColumn: null,
      trackingIdSourceMappings: [],
      sourceRop3Column: "ROP3",
      sourceCountryColumn: "Country",
      sourceIso3Column: "ISO3",
    };

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1],
            headerSelections: [alphaHeaderSelection],
            datasetClassification: "PGAC",
            workflowAssignments: [workflowAssignment],
          }),
        },
      ),
    );

    expect(response.status).toBe(201);
    expect(createGoogleSheetsConnectionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflowAssignments: [workflowAssignment] }),
    );
  });

  it("rejects invalid reviewed dataset names at the route boundary", async () => {
    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1],
            headerSelections: [alphaHeaderSelection],
            datasetSettings: [{ sheetId: 1, datasetName: "" }],
            datasetClassification: "PGAC",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(createGoogleSheetsConnectionsMock).not.toHaveBeenCalled();
  });

  it("returns domain errors without creating connections", async () => {
    createGoogleSheetsConnectionsMock.mockRejectedValue(
      new ApiConnectionError("Choose at least one valid Google Sheet tab."),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [99],
            headerSelections: [
              { sheetId: 99, mode: "manual", startRow: 1, endRow: 1 },
            ],
            datasetClassification: "PGAC",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose at least one valid Google Sheet tab.",
    });
  });

  it("returns service-account configuration errors", async () => {
    createGoogleSheetsConnectionsMock.mockRejectedValue(
      new GoogleSheetsError(
        "Google Sheets service account credentials are not configured.",
        500,
      ),
    );

    const response = await POST(
      new Request(
        "http://localhost/api/admin/api-connections/google-sheets/connect",
        {
          method: "POST",
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
            selectedSheetIds: [1],
            headerSelections: [alphaHeaderSelection],
            datasetClassification: "PGAC",
          }),
        },
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Google Sheets service account credentials are not configured.",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/admin/api-connections/google-sheets/connect/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
