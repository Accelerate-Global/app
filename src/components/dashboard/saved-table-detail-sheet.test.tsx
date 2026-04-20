// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SavedDatasetTable } from "@/lib/api-types";

import { SavedTableDetailSheet } from "./saved-table-detail-sheet";

function createSavedTable(
  overrides: Partial<SavedDatasetTable> = {},
): SavedDatasetTable {
  return {
    id: "saved-table-1",
    datasetId: "dataset-1",
    datasetFileName: "Every People Group.csv",
    name: "Saved table",
    details: "",
    filters: {
      region: {
        enabled: true,
        selectedRegionIds: ["region-global"],
        selectedRegionNames: ["Global"],
        enabledCountryNames: ["India", "Nepal"],
      },
      country: {
        enabled: false,
        selectedCountryNames: [],
      },
      watchlist: {
        enabled: false,
        threshold: 2,
        engagementPhaseThreshold: 6,
        frontierGroupValue: true,
      },
      uupg: {
        enabled: false,
      },
      sorting: [],
    },
    savedRowCount: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("SavedTableDetailSheet", () => {
  it("shows Global in the filter summary when the saved table uses the Global selector", () => {
    render(
      <SavedTableDetailSheet
        savedTable={createSavedTable()}
        dataset={null}
        open
        isSaving={false}
        isDeleting={false}
        onOpenChange={vi.fn()}
        onSaveSavedTable={vi.fn()}
        onDeleteSavedTable={vi.fn()}
      />,
    );

    expect(screen.getByText("Global")).toBeTruthy();
  });

  it("maps a legacy region-off default state to Global in the filter summary", () => {
    render(
      <SavedTableDetailSheet
        savedTable={createSavedTable({
          filters: {
            region: {
              enabled: false,
              selectedRegionIds: [],
              selectedRegionNames: [],
              enabledCountryNames: ["India", "Nepal"],
            },
            country: {
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
            sorting: [],
          },
        })}
        dataset={null}
        open
        isSaving={false}
        isDeleting={false}
        onOpenChange={vi.fn()}
        onSaveSavedTable={vi.fn()}
        onDeleteSavedTable={vi.fn()}
      />,
    );

    expect(screen.getByText("Global")).toBeTruthy();
  });

  it("shows Off for custom country selections that no longer match a saved region", () => {
    render(
      <SavedTableDetailSheet
        savedTable={createSavedTable({
          filters: {
            region: {
              enabled: false,
              selectedRegionIds: [],
              selectedRegionNames: [],
              enabledCountryNames: [],
            },
            country: {
              enabled: true,
              selectedCountryNames: ["India"],
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
            sorting: [],
          },
        })}
        dataset={null}
        open
        isSaving={false}
        isDeleting={false}
        onOpenChange={vi.fn()}
        onSaveSavedTable={vi.fn()}
        onDeleteSavedTable={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Off").length).toBeGreaterThanOrEqual(1);
  });
});
