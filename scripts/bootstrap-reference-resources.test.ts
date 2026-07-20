import { describe, expect, it, vi } from "vitest";

import { ReferenceResourceNotFoundError } from "@/lib/reference-resources";
import { COUNTRY_RESOURCE_KEY, ROP_RESOURCE_KEY } from "@/lib/reference-resources/types";

import { runBootstrapReferenceResources } from "./bootstrap-reference-resources";

function version(resourceKey: typeof COUNTRY_RESOURCE_KEY | typeof ROP_RESOURCE_KEY, id: string) {
  return {
    id,
    resourceKey,
    versionNumber: 1,
    lifecycleState: "valid" as const,
    schemaVersion: 1,
    contentChecksum: "a".repeat(64),
    sourceRetrievedAt: new Date(0).toISOString(),
    entryCount: resourceKey === COUNTRY_RESOURCE_KEY ? 273 : 13_069,
    validationSummary: {},
    diffSummary: {},
    createdByOwnerId: "system",
    createdAt: new Date(0).toISOString(),
    finalizedAt: new Date(0).toISOString(),
    rejectionReason: null,
    isActive: false,
  };
}

describe("reference resource bootstrap", () => {
  it("creates and activates both resource families, verifies health, and closes DB", async () => {
    const closeDb = vi.fn().mockResolvedValue(undefined);
    const activate = vi.fn().mockResolvedValue("set-id");
    const createCandidate = vi
      .fn()
      .mockResolvedValueOnce({ unchanged: false, version: version(COUNTRY_RESOURCE_KEY, "country-v1") })
      .mockResolvedValueOnce({ unchanged: false, version: version(ROP_RESOURCE_KEY, "rop-v1") });
    const result = await runBootstrapReferenceResources({
      loadCountry: vi.fn().mockResolvedValue({ entries: [] }),
      loadRop: vi.fn().mockReturnValue({ entries: [] }),
      createCandidate: createCandidate as never,
      activate,
      getActive: vi
        .fn()
        .mockRejectedValue(new ReferenceResourceNotFoundError("missing")) as never,
      health: vi.fn().mockResolvedValue({ healthy: true, resources: [], currentSetId: "set-id" }),
      closeDb,
    });

    expect(result.status).toBe("ok");
    expect(createCandidate).toHaveBeenCalledTimes(2);
    expect(activate).toHaveBeenCalledTimes(2);
    expect(closeDb).toHaveBeenCalledOnce();
  });

  it("is a no-op when checksum reconciliation resolves the current versions", async () => {
    const closeDb = vi.fn().mockResolvedValue(undefined);
    const activate = vi.fn();
    const getActive = vi
      .fn()
      .mockResolvedValueOnce({ version: version(COUNTRY_RESOURCE_KEY, "country-v1") })
      .mockResolvedValueOnce({ version: version(ROP_RESOURCE_KEY, "rop-v1") });
    const createCandidate = vi
      .fn()
      .mockResolvedValueOnce({ unchanged: true, version: version(COUNTRY_RESOURCE_KEY, "country-v1") })
      .mockResolvedValueOnce({ unchanged: true, version: version(ROP_RESOURCE_KEY, "rop-v1") });

    const result = await runBootstrapReferenceResources({
      loadCountry: vi.fn().mockResolvedValue({ entries: [] }),
      loadRop: vi.fn().mockReturnValue({ entries: [] }),
      createCandidate: createCandidate as never,
      activate,
      getActive: getActive as never,
      health: vi.fn().mockResolvedValue({ healthy: true, resources: [], currentSetId: "set-id" }),
      closeDb,
    });

    expect(result.resources.every((resource) => resource.unchanged)).toBe(true);
    expect(activate).not.toHaveBeenCalled();
    expect(closeDb).toHaveBeenCalledOnce();
  });

  it("fails closed on unhealthy parity and still closes DB", async () => {
    const closeDb = vi.fn().mockResolvedValue(undefined);
    const getActive = vi
      .fn()
      .mockResolvedValueOnce({ version: version(COUNTRY_RESOURCE_KEY, "country-v1") })
      .mockResolvedValueOnce({ version: version(ROP_RESOURCE_KEY, "rop-v1") });
    const createCandidate = vi
      .fn()
      .mockResolvedValueOnce({ unchanged: true, version: version(COUNTRY_RESOURCE_KEY, "country-v1") })
      .mockResolvedValueOnce({ unchanged: true, version: version(ROP_RESOURCE_KEY, "rop-v1") });

    await expect(
      runBootstrapReferenceResources({
        loadCountry: vi.fn().mockResolvedValue({ entries: [] }),
        loadRop: vi.fn().mockReturnValue({ entries: [] }),
        createCandidate: createCandidate as never,
        activate: vi.fn(),
        getActive: getActive as never,
        health: vi.fn().mockResolvedValue({
          healthy: false,
          currentSetId: null,
          resources: [{ resourceKey: COUNTRY_RESOURCE_KEY, healthy: false, activeVersionId: null, problems: ["missing-active-version"] }],
        }),
        closeDb,
      }),
    ).rejects.toThrow("country-territory-codes:missing-active-version");
    expect(closeDb).toHaveBeenCalledOnce();
  });
});
