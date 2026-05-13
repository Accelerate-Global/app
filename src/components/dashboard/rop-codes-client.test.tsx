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

  it("filters the single ROP table by code and opens details", () => {
    render(<RopCodesClient initialResource={buildResource()} canRefresh={false} />);

    fireEvent.change(screen.getByLabelText("Search ROP codes"), {
      target: { value: "100425" },
    });

    expect(screen.getByText("100425 - Arab")).toBeTruthy();
    expect(screen.queryByText("300031 - Acharaj")).toBeNull();

    fireEvent.click(screen.getByRole("row", { name: /100425 - Arab/ }));

    expect(screen.getByText("People description")).toBeTruthy();
    expect(screen.getAllByText("Saudi Arabia").length).toBeGreaterThan(0);
    expect(screen.getByText("SAU")).toBeTruthy();
  });

  it("downloads the visible filtered rows", () => {
    render(<RopCodesClient initialResource={buildResource()} canRefresh={false} />);
    const appendSpy = vi.spyOn(document.body, "append");
    const link = document.createElement("a");
    const clickMock = vi.spyOn(link, "click").mockImplementation(() => undefined);
    const removeMock = vi.spyOn(link, "remove").mockImplementation(() => undefined);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName, options) =>
        tagName === "a"
          ? link
          : Document.prototype.createElement.call(document, tagName, options),
      );
    fireEvent.change(screen.getByLabelText("Search ROP codes"), {
      target: { value: "Acharaj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(createObjectUrlMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(link.href).toBe("blob:rop-codes");
    expect(link.download).toBe("rop-codes.csv");
    expect(appendSpy).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:rop-codes");
    createElementSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it("refreshes from HIS for admins", async () => {
    const refreshedResource = {
      ...buildResource(),
      entryCount: 1,
      entries: [buildResource().entries[0]],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => refreshedResource,
      }),
    );

    render(<RopCodesClient initialResource={buildResource()} canRefresh />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByText("1 visible")).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith("/api/rop-codes/refresh", {
      method: "POST",
    });
  });

  it("hides refresh for non-admin users", () => {
    render(<RopCodesClient initialResource={buildResource()} canRefresh={false} />);

    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  });
});
