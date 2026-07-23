import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(async () => ({
    ownerId: "admin",
    email: "admin@example.test",
    fullName: null,
    workspaceRole: "admin",
    isDatasetAdmin: true,
    mode: "supabase",
  })),
}));
vi.mock("@/lib/tier2-products", async () => {
  const schemas = await import("@/lib/tier2-products/schemas");
  return {
    ...schemas,
    createTier2LegacyComparison: vi.fn(),
    getTier2LegacyComparison: vi.fn(),
    tier2ProductRouteError: vi.fn((_title, fallback) =>
      Response.json({ error: fallback }, { status: 500 })),
  };
});

import {
  createTier2LegacyComparison,
  getTier2LegacyComparison,
} from "@/lib/tier2-products";
import { GET, POST } from "./route";

const context = {
  params: Promise.resolve({
    runId: "10000000-0000-4000-8000-000000000001",
  }),
};

describe("Tier 2 legacy comparison route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retains a validated legacy rows artifact through the admin route", async () => {
    vi.mocked(createTier2LegacyComparison).mockResolvedValue({
      runId: "10000000-0000-4000-8000-000000000001",
      schemaVersion: 1,
    } as never);
    const response = await POST(new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legacy: {
          columns: [{ key: "pgic", label: "PG_AX_unique_PG_ID_PGIC", sourceIndex: 0 }],
          rows: [{ pgic: "10-jp-100001-LAO" }],
        },
        reason: "Reviewed retained legacy snapshot",
      }),
    }), context as never);

    expect(response.status).toBe(201);
    expect(createTier2LegacyComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "10000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("returns and downloads the retained immutable report", async () => {
    const artifact = {
      schemaVersion: 1,
      runId: "10000000-0000-4000-8000-000000000001",
      report: { schemaVersion: 1 },
    };
    const body = JSON.stringify(artifact);
    vi.mocked(getTier2LegacyComparison).mockResolvedValue({
      artifact,
      body,
    } as never);

    const response = await GET(
      new Request("http://test?download=1"),
      context as never,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "tier2-legacy-comparison",
    );
    expect(await response.text()).toBe(body);
  });
});
