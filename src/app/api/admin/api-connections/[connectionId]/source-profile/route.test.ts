import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SourceProfileBindingConflictError,
  getSourceProfileBinding,
  removeSourceProfileBinding,
  resolveSourceProfile,
  upsertSourceProfileBinding,
} from "@/lib/source-profiles";

import { DELETE, GET, PUT } from "./route";

vi.mock("@/lib/source-profiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/source-profiles")>()),
  getSourceProfileBinding: vi.fn(),
  removeSourceProfileBinding: vi.fn(),
  resolveSourceProfile: vi.fn(),
  upsertSourceProfileBinding: vi.fn(),
}));

vi.mock("@/lib/route-guard", () => ({
  withRoute:
    (
      _options: unknown,
      handler: (identity: unknown, request: Request, context: unknown) => unknown,
    ) =>
    (request: Request, context: unknown) =>
      handler(
        { ownerId: "owner-1", email: "admin@example.com" },
        request,
        context,
      ),
}));

const context = { params: Promise.resolve({ connectionId: "connection-1" }) };

describe("source profile binding route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the configured profile", async () => {
    vi.mocked(getSourceProfileBinding).mockResolvedValue(null);
    vi.mocked(resolveSourceProfile).mockResolvedValue({
      key: "wcd-people-groups",
      engineKey: "wcd",
      label: "World Christian Database forming",
      stableKeyColumn: "Record ID",
      configurable: true,
    });
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { engineKey: "wcd" },
    });
  });

  it("validates and writes a configurable profile", async () => {
    vi.mocked(upsertSourceProfileBinding).mockResolvedValue({
      connectionId: "connection-1",
      sourceProfileKey: "wcd-people-groups",
      stableKeyColumn: "Record ID",
      configuredByOwnerId: "owner-1",
      configuredAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
    });
    vi.mocked(resolveSourceProfile).mockResolvedValue(null);
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify({
          sourceProfileKey: "wcd-people-groups",
          stableKeyColumn: "Record ID",
        }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(upsertSourceProfileBinding).toHaveBeenCalledWith({
      connectionId: "connection-1",
      actorOwnerId: "owner-1",
      sourceProfileKey: "wcd-people-groups",
      stableKeyColumn: "Record ID",
    });
  });

  it("does not expose provider or secret-like errors", async () => {
    vi.mocked(upsertSourceProfileBinding).mockRejectedValue(
      new Error("postgres password=super-secret duplicate key detail"),
    );
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify({
          sourceProfileKey: "wcd-people-groups",
          stableKeyColumn: "Record ID",
        }),
      }),
      context,
    );
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).not.toContain("super-secret");
    expect(body).not.toContain("postgres");
  });

  it("returns a safe conflict when the profile belongs to another connection", async () => {
    vi.mocked(upsertSourceProfileBinding).mockRejectedValue(
      new SourceProfileBindingConflictError("wcd-people-groups"),
    );
    const response = await PUT(
      new Request("https://example.test", {
        method: "PUT",
        body: JSON.stringify({
          sourceProfileKey: "wcd-people-groups",
          stableKeyColumn: "Record ID",
        }),
      }),
      context,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "That source profile is already assigned to another dataset connection. Remove the existing assignment before reassigning it.",
    });
  });

  it("removes a binding", async () => {
    vi.mocked(removeSourceProfileBinding).mockResolvedValue({
      connectionId: "connection-1",
      sourceProfileKey: "accelerate-owned-people-groups",
      stableKeyColumn: "Stable ID",
      configuredByOwnerId: "owner-1",
      configuredAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
    });
    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      context,
    );
    expect(response.status).toBe(200);
  });
});
