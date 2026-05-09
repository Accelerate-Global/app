import { beforeEach, describe, expect, it, vi } from "vitest";

import { getGoogleSheetsConnectionDraft } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  getGoogleSheetsConnectionDraft: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getGoogleSheetsConnectionDraftMock = vi.mocked(getGoogleSheetsConnectionDraft);

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

const draft = {
  id: "draft-1",
  spreadsheetId: "sheet_123",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
  spreadsheetTitle: "Mission Sheet",
  sheets: [{ sheetId: 1, title: "Alpha", index: 0 }],
  expiresAt: "2026-05-09T08:00:00.000Z",
  createdAt: "2026-05-09T07:45:00.000Z",
  updatedAt: "2026-05-09T07:45:00.000Z",
};

describe("/api/admin/api-connections/google-sheets/drafts/[draftId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated draft requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(401);
    expect(getGoogleSheetsConnectionDraftMock).not.toHaveBeenCalled();
  });

  it("returns ready drafts for dataset admins", async () => {
    getGoogleSheetsConnectionDraftMock.mockResolvedValue(draft);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ draft });
    expect(getGoogleSheetsConnectionDraftMock).toHaveBeenCalledWith({
      identity,
      draftId: "draft-1",
    });
  });

  it("returns not found for missing or expired drafts", async () => {
    getGoogleSheetsConnectionDraftMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
  });
});
