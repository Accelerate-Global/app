import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { executePartnerExportRun, startPartnerExportRun } from "@/lib/partner-exports";
import { POST } from "./route";

const { afterMock } = vi.hoisted(() => ({ afterMock: vi.fn() }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/partner-exports", async () => {
  const actual = await vi.importActual<typeof import("@/lib/partner-exports")>("@/lib/partner-exports");
  return { ...actual, executePartnerExportRun: vi.fn(), startPartnerExportRun: vi.fn() };
});

describe("partner export run route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1", email: "admin@example.com", fullName: null,
      workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase",
    });
    afterMock.mockImplementation(async (callback: () => Promise<void>) => callback());
  });

  it("queues and schedules an export run", async () => {
    vi.mocked(startPartnerExportRun).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(executePartnerExportRun).mockResolvedValue({ id: "run-1" } as never);
    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ warningsAcknowledged: true }) }),
      { params: Promise.resolve({ datasetId: "dataset-1", profileId: "profile-1" }) },
    );
    expect(response.status).toBe(202);
    expect(executePartnerExportRun).toHaveBeenCalledWith({ runId: "run-1" });
  });
});
