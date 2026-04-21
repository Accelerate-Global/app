// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary, SavedDatasetFilterState } from "@/lib/api-types";

import { DatasetOpenPresetSheet } from "./dataset-open-preset-sheet";

const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const dataset = {
  id: "dataset-1",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  isPublic: true,
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
    enabled: true,
    thresholdEnabled: true,
    threshold: 2,
    engagementPhaseEnabled: true,
    engagementPhaseThreshold: 6,
    evangelicalBelieversEnabled: true,
    evangelicalBelieversThreshold: 1000,
    evangelicalPercentEnabled: true,
    evangelicalPercentThreshold: 0.05,
    frontierGroupEnabled: true,
    frontierGroupValue: true,
  },
  uupg: {
    enabled: false,
  },
  sorting: [],
};

describe("DatasetOpenPresetSheet", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lets admins save the current filters to a dataset tag preset from the sheet", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn(async () => undefined);

    render(
      <DatasetOpenPresetSheet
        open
        onOpenChange={onOpenChange}
        dataset={dataset}
        filters={filters}
        tags={[
          {
            id: "tag-1",
            label: "Watchlist",
            color: "#262531",
          },
        ]}
        selectedTagId="tag-1"
        isSaving={false}
        onSelectedTagIdChange={vi.fn()}
        onSave={onSave}
        onClear={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save open preset" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText('Saved open preset to "Watchlist".'),
    ).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_open_preset_saved",
      expect.objectContaining({
        source_surface: "dataset_open_preset_sheet",
        success: true,
        dataset_id: "dataset-1",
        tag_id: "tag-1",
      }),
    );
  });

  it("lets admins clear an existing dataset tag preset from the sheet", async () => {
    const onClear = vi.fn(async () => undefined);

    render(
      <DatasetOpenPresetSheet
        open
        onOpenChange={vi.fn()}
        dataset={dataset}
        filters={filters}
        tags={[
          {
            id: "tag-1",
            label: "Watchlist",
            color: "#262531",
            openPreset: {
              region: filters.region,
              country: filters.country,
              watchlist: {
                enabled: true,
                thresholdEnabled: true,
                threshold: 2,
                engagementPhaseEnabled: true,
                engagementPhaseThreshold: 6,
                evangelicalBelieversEnabled: true,
                evangelicalBelieversThreshold: 1000,
                evangelicalPercentEnabled: true,
                evangelicalPercentThreshold: 0.05,
                frontierGroupEnabled: true,
                frontierGroupValue: true,
              },
              uupg: filters.uupg,
            },
          },
        ]}
        selectedTagId="tag-1"
        isSaving={false}
        onSelectedTagIdChange={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear preset" }));

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Cleared the dataset open preset.")).toBeTruthy();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_open_preset_cleared",
      expect.objectContaining({
        source_surface: "dataset_open_preset_sheet",
        success: true,
        dataset_id: "dataset-1",
        tag_id: "tag-1",
      }),
    );
  });

  it("preserves the empty-state copy when there are no dataset tags", () => {
    render(
      <DatasetOpenPresetSheet
        open
        onOpenChange={vi.fn()}
        dataset={dataset}
        filters={filters}
        tags={[]}
        selectedTagId={null}
        isSaving={false}
        onSelectedTagIdChange={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        onClear={vi.fn(async () => undefined)}
      />,
    );

    expect(
      screen.getByText(
        "Add a dataset tag from Edit dataset before saving an open preset.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save open preset" })).toBeNull();
    const closeButton = screen
      .getAllByRole("button", { name: "Close" })
      .find((button) => button.getAttribute("data-smoke-close"));

    expect(
      closeButton?.getAttribute("data-smoke-close"),
    ).toBe("dataset-open-preset-sheet");
  });
});
