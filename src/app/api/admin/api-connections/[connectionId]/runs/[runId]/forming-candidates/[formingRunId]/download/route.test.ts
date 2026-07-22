import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getImbFormingArtifactDownload } from "@/lib/imb-forming";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/imb-forming", () => ({ getImbFormingArtifactDownload: vi.fn() }));

const identity = { ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin" as const, isDatasetAdmin: true, mode: "supabase" as const };
const context = { params: Promise.resolve({ connectionId: "connection-1", runId: "run-1", formingRunId: "forming-1" }) };

describe("IMB forming candidate download route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("downloads a candidate artifact", async () => {
    vi.mocked(getImbFormingArtifactDownload).mockResolvedValue({ body: "a,b", contentType: "text/csv; charset=utf-8", fileName: "formed.csv" });
    const response = await GET(new Request("http://localhost?kind=csv"), context);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("a,b");
  });

  it("rejects unknown artifact kinds", async () => {
    expect((await GET(new Request("http://localhost?kind=zip"), context)).status).toBe(400);
    expect(getImbFormingArtifactDownload).not.toHaveBeenCalled();
  });
});
