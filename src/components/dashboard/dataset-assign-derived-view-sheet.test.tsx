// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary, SavedDatasetFilterState } from "@/lib/api-types";

import { DatasetAssignDerivedViewSheet } from "./dataset-assign-derived-view-sheet";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const currentDataset = {
  id: "dataset-source",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "All People Groups",
  blobUrl: "https://example.com/source.csv",
  blobPath: "datasets/source.csv",
  isPrimary: true,
  isPublic: true,
  status: "ready",
  rowCount: 2,
  sizeBytes: 512,
  columns: [],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

const targetDataset = {
  ...currentDataset,
  id: "dataset-target",
  fileName: "South Asia",
  isPrimary: false,
} satisfies DatasetSummary;

const filters: SavedDatasetFilterState = {
  region: {
    enabled: true,
    selectedRegionIds: ["region-1"],
    selectedRegionNames: ["South Asia"],
    enabledCountryNames: ["India", "Nepal"],
  },
  country: {
    enabled: false,
    selectedCountryNames: [],
    includeAlternateCountries: false,
  },
  watchlist: {
    enabled: false,
    thresholdEnabled: true,
    threshold: 2,
    engagementPhaseEnabled: true,
    engagementPhaseThreshold: 6,
    evangelicalPopulationBelieversRuleEnabled: true,
    evangelicalPopulationBelieversRule: {
      tiers: [
        {
          minPopulation: 0,
          maxPopulation: null,
          minBelievers: 50,
        },
      ],
    },
    frontierGroupEnabled: true,
    frontierGroupValue: true,
  },
  uupg: {
    enabled: false,
  },
  hotspots: {
    enabled: false,
    metric: "unique_uupgs",
    countryCount: 10,
  },
  sorting: [
    {
      id: "people_name",
      desc: false,
    },
  ],
};

describe("DatasetAssignDerivedViewSheet", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("assigns the current filtered result to the selected dataset", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ dataset: targetDataset }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DatasetAssignDerivedViewSheet
        open
        onOpenChange={vi.fn()}
        currentDataset={currentDataset}
        sourceDatasetId={currentDataset.id}
        filters={filters}
        recordCount={2}
        assignableDatasets={[targetDataset]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign to dataset" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/datasets/dataset-target/assign-derived-view",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceDatasetId: "dataset-source",
            filters,
          }),
        },
      );
    });

    expect(
      await screen.findByText('Assigned filtered view to "South Asia".'),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open assigned dataset" }).getAttribute(
        "href",
      ),
    ).toBe("/dashboard/datasets/dataset-target");
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_assigned",
      expect.objectContaining({
        source_surface: "dataset_assign_sheet",
        success: true,
        dataset_id: "dataset-target",
        source_dataset_id: "dataset-source",
        target_dataset_id: "dataset-target",
        assigned_row_count: 2,
        filter_sections_enabled: "region",
        sorting_count: 1,
      }),
    );
  });

  it("shows API errors and tracks failed assignment attempts", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Assignment failed." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DatasetAssignDerivedViewSheet
        open
        onOpenChange={vi.fn()}
        currentDataset={currentDataset}
        sourceDatasetId={currentDataset.id}
        filters={filters}
        recordCount={2}
        assignableDatasets={[targetDataset]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assign to dataset" }));

    expect(await screen.findByText("Assignment failed.")).toBeTruthy();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_assigned",
      expect.objectContaining({
        source_surface: "dataset_assign_sheet",
        success: false,
        error_code: "dataset_assign_failed",
        dataset_id: "dataset-target",
        source_dataset_id: "dataset-source",
        target_dataset_id: "dataset-target",
      }),
    );
  });
});
