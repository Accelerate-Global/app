// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "./dashboard-client";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

function createDataset() {
  return {
    id: "dataset-1",
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columns: [
      {
        key: "people_group_id",
        label: "People Group ID",
        sourceIndex: 0,
      },
      {
        key: "country",
        label: "Country",
        sourceIndex: 1,
      },
    ],
    hiddenColumnKeys: [],
    tags: [
      {
        id: "tag-1",
        label: "Priority",
        color: "#262531",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

function createSavedTable() {
  return {
    id: "saved-table-1",
    datasetId: "dataset-1",
    datasetFileName: "Global.csv",
    name: "North Africa focus",
    details: "",
    filters: {
      region: {
        enabled: true,
        selectedRegionIds: ["region-1"],
        selectedRegionNames: ["North Africa"],
        enabledCountryNames: ["Egypt"],
      },
      country: {
        enabled: false,
        selectedCountryNames: [],
      },
      watchlist: {
        enabled: false,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
      uupg: {
        enabled: false,
      },
      sorting: [],
    },
    savedRowCount: 28,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => {
      if (input === "/api/saved-tables/saved-table-1" && init?.method === "PATCH") {
        return buildJsonResponse({
          savedTable: {
            ...createSavedTable(),
            name: "North Africa saved",
            details: "Saved from dataset detail page.",
            updatedAt: new Date("2026-04-16T02:00:00.000Z").toISOString(),
          },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders admin edit links to the standalone dataset edit page", () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    const editLink = screen.getByRole("link", { name: "Edit" });

    expect(editLink.getAttribute("href")).toBe("/dashboard/datasets/dataset-1/edit");
    expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
  });

  it("opens the saved table details sheet and persists saved table edits", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[createSavedTable()]}
        canManageDatasets={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Saved table details",
    });

    fireEvent.change(within(dialog).getByLabelText("Saved table name"), {
      target: { value: "North Africa saved" },
    });
    fireEvent.change(within(dialog).getByLabelText("Details"), {
      target: { value: "Saved from dataset detail page." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/saved-tables/saved-table-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "North Africa saved",
          details: "Saved from dataset detail page.",
        }),
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Saved table details" }),
      ).toBeNull();
    });

    expect(screen.getByText("North Africa saved")).toBeTruthy();
    expect(screen.getByText("Saved from dataset detail page.")).toBeTruthy();
  });
});
