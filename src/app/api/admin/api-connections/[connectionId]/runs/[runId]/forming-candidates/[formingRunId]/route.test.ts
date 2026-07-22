import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getImbFormingRun } from "@/lib/imb-forming";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/imb-forming", () => ({ getImbFormingRun: vi.fn() }));

const identity = { ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin" as const, isDatasetAdmin: true, mode: "supabase" as const };
const context = { params: Promise.resolve({ connectionId: "connection-1", runId: "run-1", formingRunId: "forming-1" }) };

describe("IMB forming candidate detail route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("returns candidate detail", async () => {
    vi.mocked(getImbFormingRun).mockResolvedValue({ id: "forming-1" } as never);
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ formingRun: { id: "forming-1" } });
  });

  it("returns not found", async () => {
    vi.mocked(getImbFormingRun).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });
});
