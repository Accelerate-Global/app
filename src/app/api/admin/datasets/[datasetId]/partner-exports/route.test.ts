import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createPartnerExportProfile,
  listPartnerExports,
} from "@/lib/partner-exports";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", async () => {
  const actual = await vi.importActual<typeof import("@/lib/partner-exports")>(
    "@/lib/partner-exports",
  );
  return {
    ...actual,
    createPartnerExportProfile: vi.fn(),
    listPartnerExports: vi.fn(),
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
const context = { params: Promise.resolve({ datasetId: "dataset-1" }) };
const profileInput = {
  name: "Custom",
  partnerKey: "custom" as const,
  fileNameStem: "custom",
  columns: [
    {
      outputHeader: "Name",
      sourceColumnKeys: ["name"],
      sourceLabelSnapshot: ["Name"],
      transform: "copy" as const,
      literalValue: null,
      required: true,
      requiredSeverity: "error" as const,
    },
  ],
};

describe("partner export profile collection route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("lists profiles and runs for admins", async () => {
    vi.mocked(listPartnerExports).mockResolvedValue({ profiles: [], runs: [] });
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ profiles: [], runs: [] });
  });

  it("creates a validated profile and rejects non-admin access", async () => {
    vi.mocked(createPartnerExportProfile).mockResolvedValue({ id: "profile-1" } as never);
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(profileInput),
      }),
      context,
    );
    expect(response.status).toBe(201);

    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ...identity,
      workspaceRole: "pro",
      isDatasetAdmin: false,
    });
    const denied = await GET(new Request("http://localhost"), context);
    expect(denied.status).toBe(403);
  });
});
