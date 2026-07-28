// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PipelineReferenceResourceClient } from "./pipeline-reference-resource-client";
import type { ReferenceResourceVersionSummary } from "@/lib/reference-resources/types";

vi.mock("@/components/dashboard/reference-resource-lifecycle", () => ({
  ReferenceResourceLifecycle: () => <div>Resource version history</div>,
}));

const activeVersion: ReferenceResourceVersionSummary = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "source-aliases",
  versionNumber: 1,
  lifecycleState: "valid",
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: "2026-03-30T20:41:00.000Z",
  entryCount: 10,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: "2026-03-30T20:41:00.000Z",
  finalizedAt: "2026-03-30T20:42:00.000Z",
  rejectionReason: null,
  isActive: true,
};

const sourceAlias = {
  fieldId: "F_1",
  canonicalSourceKey: "imb",
  displayName: "IMB",
  initials: "imb",
  aliases: ["International Mission Board"],
  active: true,
};

describe("PipelineReferenceResourceClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders typed source-alias entries, download, and admin history", () => {
    render(
      <PipelineReferenceResourceClient
        resourceKey="source-aliases"
        initialEntries={[sourceAlias]}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canManageLifecycle
      />,
    );

    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.getByText("Accepted aliases")).toBeTruthy();
    expect(screen.getByText("International Mission Board")).toBeTruthy();
    expect(screen.getByText("Resource version history")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Download CSV" }).getAttribute("href"),
    ).toBe("/api/reference-resources/source-aliases/download");
  });

  it("searches entries and applies the same filter to download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [{ ...sourceAlias, canonicalSourceKey: "joshua-project", displayName: "Joshua Project" }],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      ),
    );
    render(
      <PipelineReferenceResourceClient
        resourceKey="source-aliases"
        initialEntries={[sourceAlias]}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canManageLifecycle={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search resource entries"), {
      target: { value: "joshua project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Joshua Project");
    expect(fetch).toHaveBeenCalledWith(
      "/api/reference-resources/source-aliases/entries?limit=100&search=joshua+project",
    );
    expect(
      screen.getByRole("link", { name: "Download CSV" }).getAttribute("href"),
    ).toBe(
      "/api/reference-resources/source-aliases/download?search=joshua+project",
    );
  });

  it("loads another cursor page without replacing current entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [{ ...sourceAlias, fieldId: "F_2", canonicalSourceKey: "wcd", displayName: "WCD" }],
            nextCursor: null,
          }),
          { status: 200 },
        ),
      ),
    );
    render(
      <PipelineReferenceResourceClient
        resourceKey="source-aliases"
        initialEntries={[sourceAlias]}
        activeVersion={activeVersion}
        initialNextCursor="cursor-1"
        canManageLifecycle={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await screen.findByText("WCD");
    expect(screen.getByText("IMB")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      "/api/reference-resources/source-aliases/entries?limit=100&cursor=cursor-1",
    );
  });

  it("shows an empty result and a safe request error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ entries: [], nextCursor: null }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PipelineReferenceResourceClient
        resourceKey="source-aliases"
        initialEntries={[sourceAlias]}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canManageLifecycle={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(
      await screen.findByText("No resource entries match this search."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Could not load matching resource entries.",
      ),
    );
  });

  it("renders PEID-specific evidence columns", () => {
    render(
      <PipelineReferenceResourceClient
        resourceKey="peid"
        initialEntries={[{
          peid: "800001",
          peopleName: "Example people",
          iso3: "IND",
          rop3: "123456",
          rop1: "A001",
          active: true,
          parentStatus: "linked",
          missingParentReason: null,
        }]}
        activeVersion={{ ...activeVersion, resourceKey: "peid", entryCount: 1 }}
        initialNextCursor={null}
        canManageLifecycle={false}
      />,
    );

    expect(screen.getByText("PEID")).toBeTruthy();
    expect(screen.getByText("Example people")).toBeTruthy();
    expect(screen.getByText("Parent relationship")).toBeTruthy();
    expect(screen.getByText("Linked")).toBeTruthy();
  });
});
