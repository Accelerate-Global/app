import { describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getPartnerExportRun } from "@/lib/partner-exports";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", () => ({ getPartnerExportRun: vi.fn() }));

describe("partner export run detail route", () => {
  it("returns completed run provenance to admins", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin",
      isDatasetAdmin: true, mode: "supabase",
    });
    vi.mocked(getPartnerExportRun).mockResolvedValue({ id: "run-1", status: "success" } as never);
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ datasetId: "dataset-1", runId: "run-1" }),
    });
    expect(response.status).toBe(200);
  });
});
