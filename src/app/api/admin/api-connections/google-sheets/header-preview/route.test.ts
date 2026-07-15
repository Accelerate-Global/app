import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiConnectionError,
  previewGoogleSheetsConnectionHeader,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/api-connections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-connections")>(
    "@/lib/api-connections",
  );
  return {
    ApiConnectionError: actual.ApiConnectionError,
    previewGoogleSheetsConnectionHeader: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const previewGoogleSheetsConnectionHeaderMock = vi.mocked(
  previewGoogleSheetsConnectionHeader,
);
const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};
const selection = {
  sheetId: 1,
  mode: "manual" as const,
  startRow: 2,
  endRow: 3,
};
const preview = {
  sheetId: 1,
  sheetTitle: "Alpha",
  inspectedRowCount: 5,
  candidates: [],
  recommendedRow: 3,
  selected: {
    mode: "manual" as const,
    startRow: 2,
    endRow: 3,
    headers: ["Identity / People Group"],
    fingerprint: "fingerprint",
    confidence: "medium" as const,
  },
  sampleRows: [["Alpha"]],
};

describe("/api/admin/api-connections/google-sheets/header-preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("previews a selected header range for an admin", async () => {
    previewGoogleSheetsConnectionHeaderMock.mockResolvedValue(preview);
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          sheetId: 1,
          selection,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preview });
    expect(previewGoogleSheetsConnectionHeaderMock).toHaveBeenCalledWith({
      identity,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      sheetId: 1,
      selection,
    });
  });

  it("rejects non-admin previews before reading Sheet values", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "pro",
      isDatasetAdmin: false,
    });
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          sheetId: 1,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(previewGoogleSheetsConnectionHeaderMock).not.toHaveBeenCalled();
  });

  it("returns domain errors without leaking provider details", async () => {
    previewGoogleSheetsConnectionHeaderMock.mockRejectedValue(
      new ApiConnectionError("Review the selected header rows.", 409),
    );
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          sheetId: 1,
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Review the selected header rows.",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/admin/api-connections/google-sheets/header-preview/route.ts",
      "utf8",
    );
    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
