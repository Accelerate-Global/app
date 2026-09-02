import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";
import { createPrivateDataChatSemanticContextCandidate } from "@/lib/private-data-chat/semantic-context-candidate";

import {
  createReferenceResourceCandidate,
  getActiveReferenceResource,
} from "./index";
import { refreshReferenceResourceCandidate } from "./refresh";

vi.mock("@/lib/iso-country-codes", () => ({
  refreshIsoCountryCodeResourceFromOfficialSource: vi.fn(),
}));
vi.mock("@/lib/rop-codes", () => ({ refreshRopCodeResourceFromHis: vi.fn() }));
vi.mock("@/lib/private-data-chat/semantic-context-candidate", () => ({
  createPrivateDataChatSemanticContextCandidate: vi.fn(),
}));
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

  it("routes semantic refresh through the reviewed candidate builder", async () => {
    vi.mocked(createPrivateDataChatSemanticContextCandidate).mockResolvedValue({
      unchanged: false,
      version: { id: "semantic-candidate" },
    } as never);
    await expect(
      refreshReferenceResourceCandidate({
        resourceKey: "semantic-context-catalog",
        actorOwnerId: "admin-1",
      }),
    ).resolves.toMatchObject({ version: { id: "semantic-candidate" } });
    expect(createPrivateDataChatSemanticContextCandidate).toHaveBeenCalledWith({
      actorOwnerId: "admin-1",
    });
    expect(refreshRopCodeResourceFromHis).not.toHaveBeenCalled();
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

  it("persists bounded missing ROP2 relationships as candidate warnings", async () => {
    const payload = {
      sourceRetrievedAt: "2026-07-21T00:00:00.000Z",
      entries: [
        {
          id: "rop3-117966",
          rop1: null,
          rop2: { code: "C0326", name: null, display: "C0326 - Not listed" },
          rop25: { code: "303439", name: "Kabirpanthi", display: "303439 - Kabirpanthi" },
          rop3: { code: "117966", name: "Kabirpanthi", display: "117966 - Kabirpanthi" },
          joinIssue: "missing-rop2",
          joinIssueLabel: "ROP2 code is not listed in the ROP2 table",
        },
      ],
    };
    vi.mocked(refreshRopCodeResourceFromHis).mockResolvedValue(payload as never);
    vi.mocked(createReferenceResourceCandidate).mockResolvedValue({
      unchanged: false,
      version: { lifecycleState: "valid" },
    } as never);

    await expect(
      refreshReferenceResourceCandidate({
        resourceKey: "rop-codes",
        actorOwnerId: "admin-1",
      }),
    ).resolves.toMatchObject({ version: { lifecycleState: "valid" } });

    expect(createReferenceResourceCandidate).toHaveBeenCalledWith({
      resourceKey: "rop-codes",
      payload,
      actorOwnerId: "admin-1",
      findings: [
        {
          severity: "warning",
          ruleCode: "missing-rop2-parent",
          stableEntryKey: "rop3-117966",
          fieldName: "rop2",
          message:
            "ROP25 303439 references ROP2 C0326, which is absent from the HIS ROP2 layer.",
          details: {
            rop2Code: "C0326",
            rop25Code: "303439",
          },
        },
      ],
    });
  });
});
