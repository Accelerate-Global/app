import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  archivePartnerExportProfile,
  updatePartnerExportProfile,
} from "@/lib/partner-exports";
import { DELETE, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", async () => {
  const actual = await vi.importActual<typeof import("@/lib/partner-exports")>(
    "@/lib/partner-exports",
  );
  return {
    ...actual,
    archivePartnerExportProfile: vi.fn(),
    updatePartnerExportProfile: vi.fn(),
  };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};
const context = {
  params: Promise.resolve({ datasetId: "dataset-1", profileId: "profile-1" }),
};

describe("partner export profile route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("updates and archives profiles", async () => {
    const profile = { id: "profile-1" } as never;
    vi.mocked(updatePartnerExportProfile).mockResolvedValue(profile);
    vi.mocked(archivePartnerExportProfile).mockResolvedValue(profile);
    const payload = {
      name: "Custom",
      partnerKey: "custom",
      fileNameStem: "custom",
      columns: [{
        outputHeader: "Name",
        sourceColumnKeys: ["name"],
        sourceLabelSnapshot: ["Name"],
        transform: "copy",
        literalValue: null,
        required: false,
        requiredSeverity: "warning",
      }],
    };

    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(payload) }), context)).status).toBe(200);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context)).status).toBe(200);
  });
});
