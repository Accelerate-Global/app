import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  executeImbFormingRun,
  listImbFormingRuns,
  startImbFormingRun,
} from "@/lib/imb-forming";
import { GET, POST } from "./route";

const { afterMock } = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => Promise<void>) => void callback()),
}));

vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/imb-forming", () => ({
  executeImbFormingRun: vi.fn(),
  listImbFormingRuns: vi.fn(),
  startImbFormingRun: vi.fn(),
}));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};
const context = {
  params: Promise.resolve({ connectionId: "connection-1", runId: "run-1" }),
};

describe("IMB forming candidate collection route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("lists candidates for admins", async () => {
    vi.mocked(listImbFormingRuns).mockResolvedValue([]);
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ formingRuns: [] });
  });

  it("queues candidate execution", async () => {
    vi.mocked(startImbFormingRun).mockResolvedValue({ id: "forming-1" } as never);
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context,
    );
    expect(response.status).toBe(202);
    expect(executeImbFormingRun).toHaveBeenCalledWith("forming-1");
  });

  it("rejects non-admins", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ...identity, isDatasetAdmin: false });
    expect((await GET(new Request("http://localhost"), context)).status).toBe(403);
  });
});
