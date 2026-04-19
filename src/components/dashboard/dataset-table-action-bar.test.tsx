// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary, SavedDatasetFilterState } from "@/lib/api-types";

import { DatasetTableActionBar } from "./dataset-table-action-bar";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const dataset = {
  id: "dataset-1",
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  status: "ready",
  rowCount: 12507,
  sizeBytes: 512,
  columns: [],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

const filters: SavedDatasetFilterState = {
  region: {
    enabled: false,
    selectedRegionIds: [],
    selectedRegionNames: [],
    enabledCountryNames: [],
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
};

describe("DatasetTableActionBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the filtered count with a matching People Groups label", () => {
    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        sortedRows={[]}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    expect(screen.getByText("Current filtered table")).toBeTruthy();
    expect(screen.getByText("12,507")).toBeTruthy();
    expect(screen.getByText("People Groups")).toBeTruthy();
    expect(
      screen.queryByText("people groups in the current list"),
    ).toBeNull();
  });

  it("renders a mobile filters trigger when an opener is supplied", () => {
    const onOpenFilters = vi.fn();

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        sortedRows={[]}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        onOpenFilters={onOpenFilters}
      />,
    );

    const filterButton = screen.getByRole("button", { name: "Filters" });

    expect(filterButton.getAttribute("data-smoke-trigger")).toBe(
      "dataset-filters-sheet",
    );

    fireEvent.click(filterButton);

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("renders an admin-only open preset trigger in the action row", () => {
    const onOpenOpenPreset = vi.fn();

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        sortedRows={[]}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        onOpenOpenPreset={onOpenOpenPreset}
      />,
    );

    const actionRow = screen.getByRole("button", { name: "Download" }).parentElement;
    const openPresetButton = screen.getByRole("button", { name: "Open preset" });

    expect(actionRow?.contains(openPresetButton)).toBe(true);
    expect(openPresetButton.getAttribute("data-smoke-trigger")).toBe(
      "dataset-open-preset-sheet",
    );
    expect(screen.queryByText("Dataset open preset")).toBeNull();
    expect(screen.queryByText("Preset tag")).toBeNull();

    fireEvent.click(openPresetButton);

    expect(onOpenOpenPreset).toHaveBeenCalledTimes(1);
  });

  it("tracks saved table creation outcomes", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          savedTable: {
            id: "saved-table-1",
            name: "Saved table",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        sortedRows={[]}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save to dashboard" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/saved-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId: dataset.id,
          savedRowCount: 12507,
          filters,
        }),
      });
    });

    expect(trackAppEventMock).toHaveBeenCalledWith(
      "saved_table_created",
      expect.objectContaining({
        source_surface: "dataset_action_bar",
        success: true,
        dataset_id: "dataset-1",
        saved_table_id: "saved-table-1",
        saved_row_count: 12507,
      }),
    );
  });
});
