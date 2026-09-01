import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createPrivateDataChatSemanticContextCandidateFromGuidingDocument,
  getActivePrivateDataChatSemanticContext,
} from "@/lib/private-data-chat/semantic-context-candidate";

import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/private-data-chat/semantic-context-candidate", () => ({
  createPrivateDataChatSemanticContextCandidateFromGuidingDocument: vi.fn(),
  getActivePrivateDataChatSemanticContext: vi.fn(),
}));

describe("semantic guiding-document route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1",
      email: "blake@risencode.org",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
  });

  it("returns only the active synchronized document projection", async () => {
    vi.mocked(getActivePrivateDataChatSemanticContext).mockResolvedValue({
      payload: {
        guidingDocument: "# Definitions\n",
        definitionPackageChecksum: "a".repeat(64),
        guidingDocumentChecksum: "b".repeat(64),
      },
      version: { id: "10000000-0000-4000-8000-000000000001" },
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      document: "# Definitions\n",
      definitionPackageChecksum: "a".repeat(64),
    });
  });

  it("requires Blake approval and the active package checksum", async () => {
    const invalid = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          document: "# Changed\n",
          expectedDefinitionPackageChecksum: "a".repeat(64),
          blakeApproved: false,
        }),
      }),
    );
    expect(invalid.status).toBe(400);

    vi.mocked(
      createPrivateDataChatSemanticContextCandidateFromGuidingDocument,
    ).mockResolvedValue({ unchanged: false, changedKeys: ["field.country"] } as never);
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          document: "# Changed\n",
          expectedDefinitionPackageChecksum: "a".repeat(64),
          blakeApproved: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(
      createPrivateDataChatSemanticContextCandidateFromGuidingDocument,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        actorOwnerId: "admin-1",
        blakeApproved: true,
      }),
    );
  });
});
