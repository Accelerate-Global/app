import { describe, expect, it, vi } from "vitest";

import { ReferenceResourceNotFoundError } from "@/lib/reference-resources";

import { runBootstrapPrivateDataChatSemanticContext } from "./bootstrap-private-data-chat-semantic-context";

const version = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "semantic-context-catalog" as const,
  versionNumber: 1,
  lifecycleState: "valid" as const,
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: "2026-08-31T00:00:00.000Z",
  entryCount: 30,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "system",
  createdAt: "2026-08-31T00:00:00.000Z",
  finalizedAt: "2026-08-31T00:00:00.000Z",
  rejectionReason: null,
  isActive: false,
};

describe("private data-chat semantic bootstrap", () => {
  it("creates and activates the first reviewed immutable snapshot", async () => {
    const activate = vi.fn().mockResolvedValue(null);
    const closeDb = vi.fn().mockResolvedValue(undefined);
    const result = await runBootstrapPrivateDataChatSemanticContext({
      getActive: vi
        .fn()
        .mockRejectedValue(new ReferenceResourceNotFoundError("missing")),
      createCandidate: vi.fn().mockResolvedValue({
        unchanged: false,
        version,
        findings: [],
      }),
      activate,
      closeDb,
    } as never);

    expect(result).toMatchObject({ status: "ok", activated: true });
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedActiveVersionId: null,
        resourceKey: "semantic-context-catalog",
      }),
    );
    expect(closeDb).toHaveBeenCalledOnce();
  });

  it("reuses the active checksum-equivalent snapshot", async () => {
    const activate = vi.fn();
    const result = await runBootstrapPrivateDataChatSemanticContext({
      getActive: vi.fn().mockResolvedValue({ version }),
      createCandidate: vi.fn().mockResolvedValue({
        unchanged: true,
        version,
        findings: [],
      }),
      activate,
      closeDb: vi.fn().mockResolvedValue(undefined),
    } as never);

    expect(result).toMatchObject({ unchanged: true, activated: false });
    expect(activate).not.toHaveBeenCalled();
  });
});
