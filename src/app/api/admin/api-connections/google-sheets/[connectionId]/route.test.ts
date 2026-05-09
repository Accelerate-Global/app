import { beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectGoogleSheetsConnection } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { DELETE } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ApiConnectionError: actual.ApiConnectionError,
    disconnectGoogleSheetsConnection: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const disconnectGoogleSheetsConnectionMock = vi.mocked(
  disconnectGoogleSheetsConnection,
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
  params: Promise.resolve({
    connectionId: "11111111-1111-4111-8111-111111111111",
  }),
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
  importMode: "replace" as const,
  targetDatasetId: "dataset-1",
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

describe("/api/admin/api-connections/google-sheets/[connectionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated disconnect requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), context);

    expect(response.status).toBe(401);
    expect(disconnectGoogleSheetsConnectionMock).not.toHaveBeenCalled();
  });

  it("disconnects Google Sheets connections for dataset admins", async () => {
    disconnectGoogleSheetsConnectionMock.mockResolvedValue(connection);

    const response = await DELETE(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ connection });
    expect(disconnectGoogleSheetsConnectionMock).toHaveBeenCalledWith({
      connectionId: connection.id,
      identity,
    });
  });

  it("returns not found for non-Google or missing connections", async () => {
    disconnectGoogleSheetsConnectionMock.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
  });
});
