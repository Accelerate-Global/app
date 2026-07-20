import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";

import {
  createReferenceResourceCandidate,
  getActiveReferenceResource,
} from "./index";
import { refreshReferenceResourceCandidate } from "./refresh";

vi.mock("@/lib/iso-country-codes", () => ({
  refreshIsoCountryCodeResourceFromOfficialSource: vi.fn(),
}));
vi.mock("@/lib/rop-codes", () => ({ refreshRopCodeResourceFromHis: vi.fn() }));
vi.mock("./index", () => ({
  createReferenceResourceCandidate: vi.fn(),
  getActiveReferenceResource: vi.fn(),
  ReferenceResourceNotFoundError: class ReferenceResourceNotFoundError extends Error {},
}));

describe("refreshReferenceResourceCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a redacted invalid candidate when a ROP source build fails", async () => {
    vi.mocked(refreshRopCodeResourceFromHis).mockRejectedValue(
      new Error("provider secret should not be persisted"),
    );
    vi.mocked(getActiveReferenceResource).mockResolvedValue({
      payload: { sourceRetrievedAt: "2026-05-07T22:27:43.000Z", entries: [] },
      version: { id: "active-version" },
    } as never);
    vi.mocked(createReferenceResourceCandidate).mockResolvedValue({
      unchanged: false,
      version: { id: "invalid-version", lifecycleState: "invalid" },
    } as never);

    await expect(
      refreshReferenceResourceCandidate({
        resourceKey: "rop-codes",
        actorOwnerId: "admin-1",
      }),
    ).resolves.toMatchObject({ version: { lifecycleState: "invalid" } });

    expect(createReferenceResourceCandidate).toHaveBeenCalledOnce();
    const candidate = vi.mocked(createReferenceResourceCandidate).mock.calls[0][0];
    expect(candidate).toMatchObject({
      resourceKey: "rop-codes",
      actorOwnerId: "admin-1",
      findings: [
        {
          severity: "error",
          ruleCode: "source-refresh-failed",
          details: { errorName: "Error", status: null, code: null },
        },
      ],
      rawManifest: { outcome: "source-refresh-failed", errorName: "Error" },
    });
    expect(JSON.stringify(candidate)).not.toContain("provider secret");
    expect(candidate.payload.sourceRetrievedAt).not.toBe("2026-05-07T22:27:43.000Z");
  });

  it("passes a successful country refresh to the shared candidate lifecycle", async () => {
    const payload = {
      sourceRetrievedAt: "2026-07-18T00:00:00.000Z",
      entries: [{ displayName: "Afghanistan", alternativeNames: [] }],
    };
    vi.mocked(refreshIsoCountryCodeResourceFromOfficialSource).mockResolvedValue(payload as never);
    vi.mocked(getActiveReferenceResource).mockResolvedValue({
      payload: {
        entries: [{ displayName: "Afghanistan", alternativeNames: ["Afganistan"] }],
      },
    } as never);
    vi.mocked(createReferenceResourceCandidate).mockResolvedValue({ unchanged: false } as never);

    await refreshReferenceResourceCandidate({
      resourceKey: "country-territory-codes",
      actorOwnerId: "admin-1",
    });

    expect(createReferenceResourceCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceKey: "country-territory-codes",
        actorOwnerId: "admin-1",
        payload: expect.objectContaining({
          entries: [
            expect.objectContaining({
              displayName: "Afghanistan",
              alternativeNames: ["Afganistan"],
            }),
          ],
        }),
      }),
    );
  });
});
