// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DatasetOpenPreset,
  DatasetSummary,
  SavedDatasetSort,
} from "@/lib/api-types";

import { DatasetDetailClient } from "./dataset-detail-client";

const actionBarSpy = vi.fn();
const datasetTableSpy = vi.fn();
const useDatasetTableStateMock = vi.fn();
const viewSwitchGridSpy = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/components/dashboard/dataset-table-action-bar", () => ({
  DatasetTableActionBar: (props: unknown) => {
    actionBarSpy(props);
    return <div data-testid="dataset-table-action-bar" />;
  },
}));

vi.mock("@/components/dashboard/dataset-table", () => ({
  DatasetTable: (props: unknown) => {
    datasetTableSpy(props);
    return <div data-testid="dataset-table" />;
  },
}));

vi.mock("@/components/dashboard/dataset-view-switch-grid", () => ({
  DatasetViewSwitchGrid: (props: unknown) => {
    viewSwitchGridSpy(props);
    return <div data-testid="dataset-view-switch-grid" />;
  },
}));

vi.mock("@/components/dashboard/use-dataset-table-state", () => ({
  useDatasetTableState: (props: unknown) => useDatasetTableStateMock(props),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const datasetBase = {
  id: "dataset-1",
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  status: "ready",
  rowCount: 2,
  sizeBytes: 512,
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies Omit<DatasetSummary, "columns">;

function createInitialFilters(
  overrides: Partial<DatasetOpenPreset> = {},
): DatasetOpenPreset {
  return {
    region: {
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
      enabledCountryNames: [],
      ...overrides.region,
    },
    country: {
      enabled: false,
      selectedCountryNames: [],
      ...overrides.country,
    },
    watchlist: {
      enabled: false,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalBelieversEnabled: true,
      evangelicalBelieversThreshold: 50,
      evangelicalPercentEnabled: true,
      evangelicalPercentThreshold: 0.05,
      frontierGroupEnabled: true,
      frontierGroupValue: true,
      ...overrides.watchlist,
    },
    uupg: {
      enabled: false,
      ...overrides.uupg,
    },
  };
}

describe("DatasetDetailClient", () => {
  beforeEach(() => {
    actionBarSpy.mockReset();
    datasetTableSpy.mockReset();
    useDatasetTableStateMock.mockReset();
    viewSwitchGridSpy.mockReset();
    trackAppEventMock.mockReset();
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      availableCountryNames: [],
      sortedRows: [],
      recordCount: 2,
      isLoading: false,
      error: null,
    });
  });

  it("renders a sticky desktop filter rail and a main content column above the table", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const filterGrid = screen.getByTestId("dataset-view-switch-grid");
    const actionBar = screen.getByTestId("dataset-table-action-bar");
    const stickyRail = filterGrid.parentElement;
    const desktopRail = stickyRail?.parentElement;
    const layout = desktopRail?.parentElement;
    const mainColumn = actionBar.parentElement;
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      onOpenFilters?: () => void;
      analyticsContext: {
        route: string;
      };
    };

    expect(layout).toBeTruthy();
    expect(layout?.className).toContain("xl:grid-cols-[22rem_minmax(0,1fr)]");
    expect(desktopRail?.className).toContain("hidden");
    expect(desktopRail?.className).toContain("xl:block");
    expect(stickyRail?.className).toContain("sticky");
    expect(mainColumn).toBe(screen.getByTestId("dataset-table").parentElement);
    expect(actionBarProps.onOpenFilters).toEqual(expect.any(Function));
    expect(actionBarProps.analyticsContext.route).toBe("dataset_detail");
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dataset_opened",
      expect.objectContaining({
        source_surface: "dataset_detail_page",
        success: true,
        dataset_id: "dataset-1",
        dataset_source: "dashboard",
      }),
    );
  });

  it("passes supported UUPG filter state into the card, shared table state, and action bar", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "engage_global_engagement_anywhere",
              label: "Engage_Global_Engagement_Anywhere",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{
          engage_global_engagement_anywhere: {
            definition: "UUPG definition",
            displayLabel: "Watchlist status",
            effectiveLabel: "Watchlist status",
            linkedSources: [],
          },
        }}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.calls[0]?.[0] as {
      uupgCard: {
        enabled: boolean;
        supported: boolean;
        fieldLabel: string;
        fieldDefinition: string;
      };
    };
    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      uupgFilter: { enabled: boolean; isSupported: boolean };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        uupg: { enabled: boolean };
      };
      recordCount: number;
    };

    expect(viewSwitchGridProps.uupgCard).toMatchObject({
      enabled: false,
      supported: true,
      fieldLabel: "Watchlist status",
      fieldDefinition: "UUPG definition",
    });
    expect(datasetTableStateProps.uupgFilter).toEqual({
      enabled: false,
      isSupported: true,
    });
    expect(actionBarProps.filters.uupg).toEqual({
      enabled: false,
    });
    expect(actionBarProps.recordCount).toBe(2);
  });

  it("hides Globe from the region card and uses the visible regions for filtering", () => {
    const regions = [
      {
        id: "f1000000-0000-4000-8000-000000000001",
        name: "Globe",
        description: "",
        sortOrder: 1,
        countries: ["Nepal"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f1000000-0000-4000-8000-000000000002",
        name: "South Asia",
        description: "Countries across South Asia.",
        sortOrder: 2,
        countries: ["India"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.calls[0]?.[0] as {
      regionCard: {
        enabled: boolean;
        supported: boolean;
        selectors: Array<{ id: string; checked: boolean }>;
      };
    };
    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      regionFilter: {
        enabled: boolean;
        isSupported: boolean;
        hasConfiguredRegions: boolean;
        enabledCountryNames: string[];
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
      };
    };

    expect(viewSwitchGridProps.regionCard).toMatchObject({
      enabled: true,
      supported: true,
      selectors: [
        {
          id: "f1000000-0000-4000-8000-000000000002",
          checked: true,
        },
      ],
    });
    expect(datasetTableStateProps.regionFilter).toEqual({
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India"],
    });
    expect(actionBarProps.filters.region).toEqual({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000002"],
      selectedRegionNames: ["South Asia"],
      enabledCountryNames: ["India"],
    });
  });

  it("passes country filter state into the card, shared table state, and action bar", () => {
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      availableCountryNames: ["Egypt", "Jordan", "Turkey"],
      sortedRows: [],
      recordCount: 2,
      isLoading: false,
      error: null,
    });

    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
            {
              key: "alternate_countries",
              label: "Alternate Countries",
              sourceIndex: 1,
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        enabled: boolean;
        supported: boolean;
        availableCountries: string[];
        selectedCountries: string[];
        onEnabledChange: (enabled: boolean) => void;
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    expect(initialViewSwitchGridProps.countryCard).toMatchObject({
      enabled: false,
      supported: true,
      availableCountries: ["Egypt", "Jordan", "Turkey"],
      selectedCountries: [],
    });

    act(() => {
      initialViewSwitchGridProps.countryCard.onEnabledChange(true);
      initialViewSwitchGridProps.countryCard.onToggleCountry("Jordan", true);
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      countryFilter: {
        enabled: boolean;
        isSupported: boolean;
        selectedCountryNames: string[];
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        country: {
          enabled: boolean;
          selectedCountryNames: string[];
        };
      };
    };

    expect(latestDatasetTableStateProps.countryFilter).toEqual({
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Jordan"],
    });
    expect(latestActionBarProps.filters.country).toEqual({
      enabled: true,
      selectedCountryNames: ["Jordan"],
    });
  });

  it("lets the region header switch disable region filtering", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[
          {
            id: "f1000000-0000-4000-8000-000000000002",
            name: "South Asia",
            description: "Countries across South Asia.",
            sortOrder: 1,
            countries: ["India"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onEnabledChange: (enabled: boolean) => void;
      };
    };

    act(() => {
      initialViewSwitchGridProps.regionCard.onEnabledChange(false);
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
        };
      };
    };

    expect(latestDatasetTableStateProps.regionFilter.enabled).toBe(false);
    expect(latestActionBarProps.filters.region.enabled).toBe(false);
  });

  it("passes supported watchlist filter state into the card, shared table state, and action bar", () => {
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [{ id: "christianity_gsec", desc: false }],
      visibleColumns: [],
      availableCountryNames: [],
      sortedRows: [],
      recordCount: 5,
      isLoading: false,
      error: null,
    });

    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "christianity_gsec",
              label: "Christianity_GSEC",
              sourceIndex: 0,
            },
            {
              key: "christianity_frontier_group",
              label: "Christianity_Frontier_Group",
              sourceIndex: 1,
            },
            {
              key: "engage_8_phases_of_engagement",
              label: "Engage_8_Phases_of_Engagement",
              sourceIndex: 2,
            },
            {
              key: "pg_population",
              label: "PG_Population",
              sourceIndex: 3,
            },
            {
              key: "percent_evangelical_pgac",
              label: "Percent_Evangelical_PGAC",
              sourceIndex: 4,
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{
          christianity_gsec: {
            definition: "Watchlist status definition",
            displayLabel: "Christianity: GSEC",
            effectiveLabel: "Christianity: GSEC",
            linkedSources: [],
          },
          christianity_frontier_group: {
            definition: "Frontier group definition",
            displayLabel: "Christianity: Frontier Group Y/N",
            effectiveLabel: "Christianity: Frontier Group Y/N",
            linkedSources: [],
          },
          engage_8_phases_of_engagement: {
            definition: "Engagement phase definition",
            displayLabel: "Engage: 8 Phases of Engagement",
            effectiveLabel: "Engage: 8 Phases of Engagement",
            linkedSources: [],
          },
          pg_population: {
            definition: "Population definition",
            displayLabel: "People Group: Population",
            effectiveLabel: "People Group: Population",
            linkedSources: [],
          },
          percent_evangelical_pgac: {
            definition: "Percent evangelical definition",
            displayLabel: "Percent Evangelical PGAC",
            effectiveLabel: "Percent Evangelical PGAC",
            linkedSources: [],
          },
        }}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.calls[0]?.[0] as {
      watchlistCard: {
        enabled: boolean;
        supported: boolean;
        thresholdLabel: string;
        thresholdDefinition: string;
        thresholdEnabled: boolean;
        threshold: number;
        minThreshold: number;
        maxThreshold: number;
        engagementPhaseLabel: string;
        engagementPhaseDefinition: string;
        engagementPhaseEnabled: boolean;
        engagementPhaseThreshold: number;
        evangelicalBelieversLabel: string;
        evangelicalBelieversDefinition: string;
        evangelicalBelieversEnabled: boolean;
        evangelicalBelieversThreshold: number;
        evangelicalPercentLabel: string;
        evangelicalPercentDefinition: string;
        evangelicalPercentEnabled: boolean;
        evangelicalPercentThreshold: number;
        frontierGroupLabel: string;
        frontierGroupDefinition: string;
        frontierGroupEnabled: boolean;
        frontierGroupValue: boolean;
      };
    };
    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      watchlistFilter: {
        enabled: boolean;
        isSupported: boolean;
        thresholdEnabled: boolean;
        threshold: number;
        engagementPhaseEnabled: boolean;
        engagementPhaseThreshold: number;
        evangelicalBelieversEnabled: boolean;
        evangelicalBelieversThreshold: number;
        evangelicalPercentEnabled: boolean;
        evangelicalPercentThreshold: number;
        frontierGroupEnabled: boolean;
        frontierGroupValue: boolean;
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        watchlist: {
          enabled: boolean;
          thresholdEnabled?: boolean;
          threshold: number;
          engagementPhaseEnabled?: boolean;
          engagementPhaseThreshold: number;
          evangelicalBelieversEnabled?: boolean;
          evangelicalBelieversThreshold: number;
          evangelicalPercentEnabled?: boolean;
          evangelicalPercentThreshold: number;
          frontierGroupEnabled?: boolean;
          frontierGroupValue: boolean;
        };
        sorting: Array<{ id: string; desc: boolean }>;
      };
      recordCount: number;
    };

    expect(viewSwitchGridProps.watchlistCard).toMatchObject({
      enabled: false,
      supported: true,
      thresholdLabel: "Christianity: GSEC",
      thresholdDefinition: "Watchlist status definition",
      thresholdEnabled: true,
      threshold: 2,
      minThreshold: 0,
      maxThreshold: 6,
      engagementPhaseLabel: "Engage: 8 Phases of Engagement",
      engagementPhaseDefinition: "Engagement phase definition",
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalBelieversLabel: "Min. # of Evangelical Believers",
      evangelicalBelieversDefinition:
        "Calculated as People Group: Population * (Percent Evangelical PGAC / 100).",
      evangelicalBelieversEnabled: true,
      evangelicalBelieversThreshold: 50,
      minEvangelicalBelieversThreshold: 50,
      evangelicalPercentLabel: "Min. Evangelical %",
      evangelicalPercentDefinition: "Percent evangelical definition",
      evangelicalPercentEnabled: true,
      evangelicalPercentThreshold: 0.05,
      frontierGroupLabel: "Christianity: Frontier Group Y/N",
      frontierGroupDefinition: "Frontier group definition",
      frontierGroupEnabled: true,
      frontierGroupValue: true,
    });
    expect(datasetTableStateProps.watchlistFilter).toEqual({
      enabled: false,
      isSupported: true,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalBelieversEnabled: true,
      evangelicalBelieversThreshold: 50,
      evangelicalPercentEnabled: true,
      evangelicalPercentThreshold: 0.05,
      frontierGroupEnabled: true,
      frontierGroupValue: true,
    });
    expect(actionBarProps.filters.watchlist).toEqual({
      enabled: false,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalBelieversEnabled: true,
      evangelicalBelieversThreshold: 50,
      evangelicalPercentEnabled: true,
      evangelicalPercentThreshold: 0.05,
      frontierGroupEnabled: true,
      frontierGroupValue: true,
    });
    expect(actionBarProps.filters.sorting).toEqual([
      {
        id: "christianity_gsec",
        desc: false,
      },
    ]);
    expect(actionBarProps.recordCount).toBe(5);
  });

  it("clamps the evangelical believers threshold at 50", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "christianity_gsec",
              label: "Christianity_GSEC",
              sourceIndex: 0,
            },
            {
              key: "christianity_frontier_group",
              label: "Christianity_Frontier_Group",
              sourceIndex: 1,
            },
            {
              key: "engage_8_phases_of_engagement",
              label: "Engage_8_Phases_of_Engagement",
              sourceIndex: 2,
            },
            {
              key: "pg_population",
              label: "PG_Population",
              sourceIndex: 3,
            },
            {
              key: "percent_evangelical_pgac",
              label: "Percent_Evangelical_PGAC",
              sourceIndex: 4,
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      watchlistCard: {
        onEvangelicalBelieversThresholdChange: (value: number) => void;
      };
    };

    act(() => {
      initialViewSwitchGridProps.watchlistCard.onEvangelicalBelieversThresholdChange(
        49,
      );
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      watchlistFilter: {
        evangelicalBelieversThreshold: number;
      };
    };

    expect(
      latestDatasetTableStateProps.watchlistFilter.evangelicalBelieversThreshold,
    ).toBe(50);
  });

  it("uses an initial preset to override the default region-on behavior", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[
          {
            id: "f1000000-0000-4000-8000-000000000002",
            name: "South Asia",
            description: "Countries across South Asia.",
            sortOrder: 1,
            countries: ["India"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
        initialFilters={createInitialFilters()}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
        };
      };
    };

    expect(datasetTableStateProps.regionFilter).toMatchObject({
      enabled: false,
      enabledCountryNames: ["India"],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: false,
      selectedRegionIds: [],
    });
  });

  it("hydrates saved-view region matching by current region name and restores initial sorting", () => {
    const initialSorting: SavedDatasetSort[] = [
      {
        id: "geo_country_name",
        desc: true,
      },
    ];

    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[
          {
            id: "f1000000-0000-4000-8000-000000000002",
            name: "South Asia",
            description: "Countries across South Asia.",
            sortOrder: 1,
            countries: ["India"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
        initialFilters={createInitialFilters({
          region: {
            enabled: true,
            selectedRegionIds: ["missing-region-id"],
            selectedRegionNames: ["South Asia"],
            enabledCountryNames: ["India"],
          },
        })}
        initialSorting={initialSorting}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      initialSorting: SavedDatasetSort[];
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
      };
    };

    expect(datasetTableStateProps.initialSorting).toEqual(initialSorting);
    expect(datasetTableStateProps.regionFilter).toMatchObject({
      enabled: true,
      enabledCountryNames: ["India"],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000002"],
      selectedRegionNames: ["South Asia"],
    });
  });

  it("turns region filtering off when a saved view no longer matches any configured region", () => {
    render(
      <DatasetDetailClient
        dataset={{
          ...datasetBase,
          columns: [
            {
              key: "geo_country_name",
              label: "Geo_Country_Name",
              sourceIndex: 0,
            },
          ],
        }}
        regions={[
          {
            id: "f1000000-0000-4000-8000-000000000002",
            name: "South Asia",
            description: "Countries across South Asia.",
            sortOrder: 1,
            countries: ["India"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
        initialFilters={createInitialFilters({
          region: {
            enabled: true,
            selectedRegionIds: ["missing-region-id"],
            selectedRegionNames: ["Unknown Region"],
            enabledCountryNames: ["India"],
          },
        })}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
    };

    expect(datasetTableStateProps.regionFilter).toMatchObject({
      enabled: false,
      enabledCountryNames: ["India"],
    });
  });
});
