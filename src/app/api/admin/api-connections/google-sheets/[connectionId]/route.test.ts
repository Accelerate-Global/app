import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  checkGoogleSheetsConnectionAccess,
  disconnectGoogleSheetsConnection,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { DELETE, GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );

  return {
    ApiConnectionError: actual.ApiConnectionError,
    checkGoogleSheetsConnectionAccess: vi.fn(),
    disconnectGoogleSheetsConnection: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const checkGoogleSheetsConnectionAccessMock = vi.mocked(
  checkGoogleSheetsConnectionAccess,
);
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

const accessCheck = {
  connection,
  preview: {
    spreadsheetId: "sheet_123",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    spreadsheetTitle: "Mission Sheet",
    sheets: [{ sheetId: 1, title: "Alpha", index: 0 }],
  },
  serviceAccountEmail: "sheets@app-project.iam.gserviceaccount.com",
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

  it("checks saved Google Sheets access for dataset admins", async () => {
    checkGoogleSheetsConnectionAccessMock.mockResolvedValue(accessCheck);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(accessCheck);
    expect(checkGoogleSheetsConnectionAccessMock).toHaveBeenCalledWith({
      connectionId: connection.id,
      identity,
    });
  });

  it("returns not found when checking non-Google or missing connections", async () => {
    checkGoogleSheetsConnectionAccessMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
  });

  it("reports saved connection service-account access failures", async () => {
    checkGoogleSheetsConnectionAccessMock.mockRejectedValue(
      new ApiConnectionError(
        "Share this Sheet with sheets@app-project.iam.gserviceaccount.com as Viewer, then check again.",
        403,
      ),
    );

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "Share this Sheet with sheets@app-project.iam.gserviceaccount.com as Viewer, then check again.",
    });
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

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/admin/api-connections/google-sheets/[connectionId]/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
    expect(source).not.toContain("revoke");
    expect(source).not.toContain("vault");
    expect(source).not.toContain("credential");
  });
});
