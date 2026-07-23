import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/tier2-products", async () => {
  const schemas = await import("@/lib/tier2-products/schemas");
  return {
    ...schemas,
    listTier2PartnerProfiles: vi.fn(async () => [{ id: "profile" }]),
    createTier2PartnerProfile: vi.fn(async () => ({ id: "created" })),
    createTier2ContractResourceVersion: vi.fn(async () => ({
      version: { id: "version", activated: true },
      resources: [],
    })),
    activateTier2ContractResource: vi.fn(async () => []),
    listTier2ContractResources: vi.fn(async () => []),
    tier2ProductRouteError: vi.fn((_title, fallback) =>
      Response.json({ error: fallback }, { status: 500 })),
  };
});

import { getCurrentIdentity } from "@/lib/auth";
import { GET, POST } from "./profiles/route";
import { POST as resourcesPOST } from "./resources/route";

const admin = {
  ownerId: "admin",
  email: "admin@example.test",
  fullName: null,
  workspaceRole: "admin",
  isDatasetAdmin: true,
  mode: "supabase",
} as const;

describe("Tier 2 admin routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps profile reads behind the centralized admin guard", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);

    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profiles: [{ id: "profile" }] });
  });

  it("validates a profile payload before invoking durable storage", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    const response = await POST(new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    }));
    expect(response.status).toBe(400);
  });

  it("accepts a typed contract-resource import and optional atomic activation", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    const response = await resourcesPOST(new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceKey: "engagement-mappings",
        payload: { schemaVersion: 1, entries: [] },
        activate: true,
        reason: "Reviewed contract import",
      }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      version: { id: "version", activated: true },
    });
  });
});
