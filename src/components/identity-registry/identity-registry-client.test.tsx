// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IdentityRegistryClient,
  identityRunPublicationState,
} from "./identity-registry-client";

const binding = {
  bindingId: "binding-1",
  sourceProfileKey: "jp",
  stableRowKey: "jp:people:1",
  bindingState: "active" as const,
  identityId: "identity-1",
  pgacCode: "10-jp-100001",
  pgicCode: "10-jp-100001-LAO",
  allocatedValue: null,
  normalizedIso3: "LAO",
  activatedRevisionId: "revision-1",
  createdAt: "2026-07-22T00:00:00.000Z",
};

describe("IdentityRegistryClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("distinguishes the current stable-target publication from prior versions", () => {
    expect(identityRunPublicationState({ status: "published", isCurrentPublication: true })).toBe("Current");
    expect(identityRunPublicationState({ status: "published", isCurrentPublication: false })).toBe("Prior version");
    expect(identityRunPublicationState({ status: "valid", isCurrentPublication: false })).toBeNull();
  });

  it("searches canonical bindings and exposes candidate controls", () => {
    render(<IdentityRegistryClient initialOverview={{ bindings: [binding], revisions: [], runs: [] }} />);
    expect(screen.getByText("10-jp-100001-LAO")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search registry"), { target: { value: "missing" } });
    expect(screen.getByText("No matching active bindings.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Build candidate" }).hasAttribute("disabled")).toBe(true);
  });

  it("opens the exact identity run linked from source history", async () => {
    const linkedRun = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      attemptNumber: 1,
      sourcePublicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      baseRevisionId: null,
      sourceProfileKey: "imb-people-groups",
      rulesVersion: "ax-identity-v1",
      rulesChecksum: "a".repeat(64),
      resourceBindings: {},
      inputFingerprint: "b".repeat(64),
      publicationTargetKey: "identity:imb-people-groups",
      expectedCurrentPublicationId: null,
      status: "published" as const,
      inputRowCount: 1,
      outputRowCount: 1,
      reusedCount: 0,
      retainedCount: 0,
      reservedCount: 1,
      conflictCount: 0,
      unassignableCount: 0,
      warningCount: 0,
      errorCount: 0,
      outputChecksum: "c".repeat(64),
      artifactManifest: {},
      datasetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      publicationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      isCurrentPublication: true,
      registryRevisionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      rejectionReason: null,
      publicationReason: "Approved",
      reservationExpiresAt: null,
      createdAt: "2026-07-22T00:00:00.000Z",
      completedAt: "2026-07-22T00:01:00.000Z",
      findings: [],
      rows: [],
    };
    const fetchMock = vi.fn(async () =>
      Response.json({ run: linkedRun }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <IdentityRegistryClient
        initialOverview={{ bindings: [], revisions: [], runs: [linkedRun] }}
        initialSelectedRunId={linkedRun.id}
      />,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/identity-registry/runs/${linkedRun.id}`,
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Identity candidate" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Current").length).toBeGreaterThan(0);
  });
});
