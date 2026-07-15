import { describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getPartnerExportArtifactDownload } from "@/lib/partner-exports";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", () => ({ getPartnerExportArtifactDownload: vi.fn() }));

describe("partner export artifact download route", () => {
  it("returns a private attachment and denies non-admins", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin",
      isDatasetAdmin: true, mode: "supabase",
    });
    vi.mocked(getPartnerExportArtifactDownload).mockResolvedValue({
      body: new TextEncoder().encode("header\r\nvalue\r\n").buffer,
      contentType: "text/csv",
      fileName: "partner.csv",
    });
    const context = { params: Promise.resolve({ datasetId: "dataset-1", runId: "run-1" }) };
    const response = await GET(new Request("http://localhost?format=csv"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="partner.csv"');

    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "pro-1", email: null, fullName: null, workspaceRole: "pro",
      isDatasetAdmin: false, mode: "supabase",
    });
    expect((await GET(new Request("http://localhost?format=csv"), context)).status).toBe(403);
  });
});
