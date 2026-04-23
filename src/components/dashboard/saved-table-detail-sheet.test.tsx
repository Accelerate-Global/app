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
        globalEngagementAnywhereEnabled: true,
        frontierGroupEnabled: true,
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

  it("shows no countries selected when the saved table keeps an explicit empty country filter", () => {
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

    expect(screen.getByText("No countries selected")).toBeTruthy();
  });

  it("shows the hotspots summary when the saved table uses hotspots filtering", () => {
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
            hotspots: {
              enabled: true,
              metric: "population",
              countryCount: 10,
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

    expect(screen.getByText("Top 10 countries by UUPG population")).toBeTruthy();
  });

  it("shows the split UUPG summary when the saved table enables individual criteria", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: false,
              threshold: 2,
              engagementPhaseThreshold: 6,
            },
            uupg: {
              enabled: true,
              globalEngagementAnywhereEnabled: true,
              frontierGroupEnabled: false,
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

    expect(screen.getByText("Global Engagement Anywhere")).toBeTruthy();
    expect(screen.queryByText("Frontier Group")).toBeNull();
  });

  it("omits the legacy frontier-group summary from watchlist details", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              threshold: 2,
              engagementPhaseThreshold: 6,
              frontierGroupValue: false,
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

    expect(screen.getByText(/GSEC \(IMB-only\) <= 2/)).toBeTruthy();
    expect(
      screen.getByText(
        /JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Engage: 8 Phases 2-5 only/)).toBeTruthy();
    expect(screen.queryByText(/Frontier Group/)).toBeNull();
  });

  it("omits the JP-only evangelical summary when that toggle is disabled", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              threshold: 2,
              engagementPhaseThreshold: 6,
              jpOnlyEvangelicalCriteriaEnabled: false,
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

    expect(
      screen.queryByText(
        /JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical/,
      ),
    ).toBeNull();
  });

  it("renders a saved custom JP-only evangelical summary", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              threshold: 2,
              engagementPhaseThreshold: 6,
              jpOnlyEvangelicalRule: {
                minBelievers: 90,
                maxBelievers: 300_000,
                maxPercentEvangelical: 2.5,
              },
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

    expect(
      screen.getByText(
        /JP-only: < 90 believers, or 90-300,000 believers and <= 2.5% evangelical/,
      ),
    ).toBeTruthy();
  });

  it("renders saved custom GSEC and engagement-phase summaries", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              thresholdRuleVersion: 1,
              threshold: 4,
              engagementPhaseEnabled: true,
              engagementPhaseThreshold: 4,
              engagementPhaseRule: {
                minPhase: 1,
                maxPhase: 4,
              },
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

    expect(screen.getByText(/GSEC \(IMB-only\) <= 4/)).toBeTruthy();
    expect(screen.getByText(/Engage: 8 Phases 1-4 only/)).toBeTruthy();
  });

  it("omits the engagement-phase summary when that toggle is disabled", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              threshold: 2,
              engagementPhaseEnabled: false,
              engagementPhaseThreshold: 6,
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

    expect(screen.queryByText(/Engage: 8 Phases 2-5 only/)).toBeNull();
  });

  it("omits the removed population-vs-believers summary from watchlist details", () => {
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
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: true,
              threshold: 2,
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

    expect(screen.getByText(/GSEC \(IMB-only\) <= 2/)).toBeTruthy();
    expect(
      screen.getByText(
        /JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Engage: 8 Phases 2-5 only/)).toBeTruthy();
    expect(
      screen.queryByText(/Population vs Evangelical Believers/),
    ).toBeNull();
    expect(
      screen.queryByText(/at least 50 believers/),
    ).toBeNull();
  });
});
