import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { previewPartnerExportProfile } from "@/lib/partner-exports";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", async () => {
  const actual = await vi.importActual<typeof import("@/lib/partner-exports")>("@/lib/partner-exports");
  return { ...actual, previewPartnerExportProfile: vi.fn() };
});

describe("partner export preview route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin",
      isDatasetAdmin: true, mode: "supabase",
    });
  });

  it("returns a bounded preview without an artifact", async () => {
    vi.mocked(previewPartnerExportProfile).mockResolvedValue({
      preview: { headers: ["Name"], rows: [{ Name: "A" }] },
      snapshot: {},
    } as never);
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ datasetId: "dataset-1", profileId: "profile-1" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preview: { headers: ["Name"], rows: [{ Name: "A" }] },
    });
  });
});
