// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrivateDataChatSemanticCard } from "@/lib/private-data-chat/semantic-context";
import type { ReferenceResourceVersionSummary } from "@/lib/reference-resources/types";

import { SemanticContextResourceClient } from "./semantic-context-resource-client";

vi.mock("@/components/dashboard/reference-resource-lifecycle", () => ({
  ReferenceResourceLifecycle: ({ candidate }: { candidate: unknown }) => (
    <div>{candidate ? "Candidate ready" : "Semantic version history"}</div>
  ),
}));

const version: ReferenceResourceVersionSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "semantic-context-catalog",
  versionNumber: 1,
  lifecycleState: "valid",
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: "2026-08-31T00:00:00.000Z",
  entryCount: 1,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: "2026-08-31T00:00:00.000Z",
  finalizedAt: "2026-08-31T00:00:00.000Z",
  rejectionReason: null,
  isActive: true,
};

const card = {
  stableKey: "named-filter.uupg",
  kind: "named-filter",
  label: "UUPG",
  definition: "The current interactive UUPG filter is null-preserving.",
  aliases: ["unengaged unreached people group"],
  queryAuthority: "queryable",
} as PrivateDataChatSemanticCard;

describe("SemanticContextResourceClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders searchable reviewed cards and the synchronized document", () => {
    render(
      <SemanticContextResourceClient
        initialEntries={[card]}
        activeVersion={version}
        initialNextCursor={null}
        canManageLifecycle
        guidingDocument="# Definitions\n"
        definitionPackageChecksum={"b".repeat(64)}
        initialCandidate={null}
      />,
    );
    expect(screen.getByText("UUPG")).toBeTruthy();
    expect(
      (screen.getByLabelText("Semantic guiding document") as HTMLTextAreaElement)
        .value,
    ).toContain("# Definitions");
    expect(
      (screen.getByRole("button", {
        name: /Build reviewed candidate/u,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("creates a candidate only after the explicit approval control", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            unchanged: false,
            changedKeys: ["named-filter.uupg"],
            version: { ...version, id: "10000000-0000-4000-8000-000000000002" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(
      <SemanticContextResourceClient
        initialEntries={[card]}
        activeVersion={version}
        initialNextCursor={null}
        canManageLifecycle
        guidingDocument="# Definitions\n"
        definitionPackageChecksum={"b".repeat(64)}
        initialCandidate={null}
      />,
    );
    fireEvent.click(screen.getByLabelText("Blake approved semantic edits"));
    fireEvent.click(screen.getByRole("button", { name: /Build reviewed candidate/u }));
    await waitFor(() => expect(screen.getByText("Candidate ready")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(
      "/api/reference-resources/semantic-context-catalog/guiding-document",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
