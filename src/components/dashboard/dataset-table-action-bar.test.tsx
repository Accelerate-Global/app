// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DatasetSummary, SavedDatasetFilterState } from "@/lib/api-types";

import { DatasetTableActionBar } from "./dataset-table-action-bar";

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
});
