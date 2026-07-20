// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RopCodesClient } from "./rop-codes-client";
import type { RopCodeResource } from "@/lib/rop-codes";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 68,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 68,
        size: 68,
      })),
    scrollToIndex: vi.fn(),
  }),
}));

const createObjectUrlMock = vi.fn(() => "blob:rop-codes");
const revokeObjectUrlMock = vi.fn();

function buildResource(): RopCodeResource {
  return {
    sourceName: "HIS Registry of Peoples",
    sourceUrl: "https://hisregistries.org/rop/",
    featureServerUrl: "https://example.test/FeatureServer",
    sourceRetrievedAt: "2026-05-07T00:00:00.000Z",
    entryCount: 2,
    rop1Count: 1,
    rop2Count: 1,
    rop25Count: 2,
    rop3Count: 1,
    geoIndexCount: 1,
    joinIssueCounts: {
      "missing-rop25": 0,
      "parent-only-rop25": 1,
      "rop2-conflict": 0,
    },
    rop1DetailsByCode: {
      A001: {
        code: "A001",
        name: "Arab Peoples",
        description: "Affinity description",
        display: "A001 - Arab Peoples",
      },
    },
    rop2DetailsByCode: {
      C0013: {
        code: "C0013",
        name: "Arab, Arabian",
        description: "Cluster description",
        display: "C0013 - Arab, Arabian",
      },
    },
    rop25DetailsByCode: {
      "300393": {
        code: "300393",
        name: "Arab",
        description: "Kinship description",
        display: "300393 - Arab",
      },
      "300031": {
        code: "300031",
        name: "Acharaj",
        description: "Parent only",
        display: "300031 - Acharaj",
      },
    },
    rop3DetailsByCode: {
      "100425": {
        code: "100425",
        name: "Arab",
        description: "People description",
        display: "100425 - Arab",
      },
    },
    entries: [
      {
        id: "rop3-100425",
        rowType: "rop3-person",
        rop1: {
          code: "A001",
          name: "Arab Peoples",
          display: "A001 - Arab Peoples",
        },
        rop2: {
          code: "C0013",
          name: "Arab, Arabian",
          display: "C0013 - Arab, Arabian",
        },
        rop25: {
          code: "300393",
          name: "Arab",
          display: "300393 - Arab",
        },
        rop3: {
          code: "100425",
          name: "Arab",
          display: "100425 - Arab",
        },
        status: "Active",
        place: "Saudi Arabia",
        language: "Standard Arabic - (arb)",
        source: "IMB-ISPD",
        ethnicId: "M30",
        directRop2: "C0013",
        joinIssue: null,
        joinIssueLabel: null,
      },
      {
        id: "rop25-300031",
        rowType: "rop25-parent",
        rop1: {
          code: "A001",
          name: "Arab Peoples",
          display: "A001 - Arab Peoples",
        },
        rop2: {
          code: "C0013",
          name: "Arab, Arabian",
          display: "C0013 - Arab, Arabian",
        },
        rop25: {
          code: "300031",
          name: "Acharaj",
          display: "300031 - Acharaj",
        },
        rop3: null,
        status: "Active",
        place: null,
        language: null,
        source: null,
        ethnicId: null,
        directRop2: null,
        joinIssue: "parent-only-rop25",
        joinIssueLabel: "ROP25 code has no ROP3 child",
      },
    ],
    geoIndexByRop3: {
      "100425": [
        {
          geoId: 1,
          rop3: "100425",
          rog: "SA",
          geoName: "Saudi Arabia",
          peopleName: "Arab",
          peopleId3: "1",
          isoAlpha3: "SAU",
          status: "Active",
        },
      ],
    },
  };
}

const activeVersion = {
  id: "20000000-0000-4000-8000-000000000001",
  resourceKey: "rop-codes" as const,
  versionNumber: 1,
  lifecycleState: "valid" as const,
  schemaVersion: 1,
  contentChecksum: "b".repeat(64),
  sourceRetrievedAt: "2026-05-07T00:00:00.000Z",
  entryCount: 2,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: "2026-05-07T00:00:00.000Z",
  finalizedAt: "2026-05-07T00:00:00.000Z",
  rejectionReason: null,
  isActive: true,
};

describe("RopCodesClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
  });

  it("searches the paged server contract and opens details", async () => {
    const pageResource = { ...buildResource(), entries: [buildResource().entries[0]] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resource: pageResource, entries: pageResource.entries, nextCursor: null, version: activeVersion }),
    }));
    render(
      <RopCodesClient
        initialResource={buildResource()}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search ROP codes"), {
      target: { value: "100425" },
    });

    await waitFor(() => expect(screen.queryByText("300031 - Acharaj")).toBeNull());

    fireEvent.click(screen.getByRole("row", { name: /100425 - Arab/ }));

    expect(screen.getByText("People description")).toBeTruthy();
    expect(screen.getAllByText("Saudi Arabia").length).toBeGreaterThan(0);
    expect(screen.getByText("SAU")).toBeTruthy();
  });

  it("links downloads to the complete matching server export", () => {
    render(
      <RopCodesClient
        initialResource={buildResource()}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search ROP codes"), {
      target: { value: "Acharaj" },
    });
    expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
      "/api/reference-resources/rop-codes/download?search=Acharaj",
    );
  });

  it("refreshes from HIS for admins", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          unchanged: false,
          version: { ...activeVersion, id: "20000000-0000-4000-8000-000000000002", versionNumber: 2, isActive: false },
        }),
      }),
    );

    render(
      <RopCodesClient
        initialResource={buildResource()}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh
      />,
    );
    expect(screen.getByRole("button", { name: "Refresh" }).getAttribute("data-smoke-write")).toBe(
      "unsafe",
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByText("Version 2 is ready for review")).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith("/api/rop-codes/refresh", {
      method: "POST",
    });
  });

  it("hides refresh for non-admin users", () => {
    render(
      <RopCodesClient
        initialResource={buildResource()}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  });

  it("appends the next ROP cursor page with its detail context", async () => {
    const full = buildResource();
    const firstPage = { ...full, entries: [full.entries[0]] };
    const nextPage = { ...full, entries: [full.entries[1]] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resource: nextPage, entries: nextPage.entries, nextCursor: null, version: activeVersion }),
    }));
    render(
      <RopCodesClient
        initialResource={firstPage}
        activeVersion={activeVersion}
        initialNextCursor="cursor-1"
        canRefresh={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("300031 - Acharaj")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      "/api/reference-resources/rop-codes/entries?cursor=cursor-1&limit=250",
    );
  });
});
