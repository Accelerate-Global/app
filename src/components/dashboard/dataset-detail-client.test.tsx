// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DatasetOpenPreset,
  DatasetSummary,
  SavedDatasetSort,
} from "@/lib/api-types";
import { DEFAULT_POPULATION_BELIEVERS_RULE } from "@/lib/evangelical-population-believers-rule";

import { DatasetDetailClient } from "./dataset-detail-client";

const actionBarSpy = vi.fn();
const datasetTableSpy = vi.fn();
const openPresetSheetSpy = vi.fn();
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

vi.mock("@/components/dashboard/dataset-open-preset-sheet", () => ({
  DatasetOpenPresetSheet: (props: unknown) => {
    openPresetSheetSpy(props);
    return <div data-testid="dataset-open-preset-sheet" />;
  },
}));

vi.mock("@/components/dashboard/dataset-view-switch-grid", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const DatasetViewSwitchGridMock = React.memo(function DatasetViewSwitchGridMock(
    props: unknown,
  ) {
    viewSwitchGridSpy(props);
    return <div data-testid="dataset-view-switch-grid" />;
  });

  return {
    DatasetViewSwitchGrid: DatasetViewSwitchGridMock,
  };
});

vi.mock("@/components/dashboard/use-dataset-table-state", () => ({
  useDatasetTableState: (props: unknown) => useDatasetTableStateMock(props),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const datasetBase = {
  id: "dataset-1",
  backingDatasetId: null,
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
      includeAlternateCountries: false,
      ...overrides.country,
    },
    watchlist: {
      enabled: false,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalPopulationBelieversRuleEnabled: true,
      evangelicalPopulationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
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

function createFilterRegions() {
  return [
    {
      id: "f1000000-0000-4000-8000-000000000001",
      name: "Global",
      description: "",
      sortOrder: 1,
      countries: ["India", "Nepal", "Brazil", "Peru"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "f1000000-0000-4000-8000-000000000002",
      name: "South Asia",
      description: "Countries across South Asia.",
      sortOrder: 2,
      countries: ["India", "Nepal"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "f1000000-0000-4000-8000-000000000003",
      name: "Latin America",
      description: "Countries across Latin America.",
      sortOrder: 3,
      countries: ["Brazil", "Peru"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function mockCountrySyncTableState(
  input:
    | string[]
    | {
        availableCountryNames?: string[];
        datasetCountryNames?: string[];
      } = ["India", "Nepal", "Brazil", "Peru"],
) {
  const availableCountryNames = Array.isArray(input)
    ? input
    : (input.availableCountryNames ?? ["India", "Nepal", "Brazil", "Peru"]);
  const datasetCountryNames = Array.isArray(input)
    ? input
    : (input.datasetCountryNames ?? availableCountryNames);

  useDatasetTableStateMock.mockImplementation((props: {
    initialSorting?: SavedDatasetSort[];
  }) => ({
    table: {} as never,
    sorting: props.initialSorting ?? [],
    visibleColumns: [],
    datasetCountryNames,
    availableCountryNames,
    getSortedRows: () => [],
    recordCount: 2,
    isLoading: false,
    error: null,
  }));
}

describe("DatasetDetailClient", () => {
  beforeEach(() => {
    actionBarSpy.mockReset();
    datasetTableSpy.mockReset();
    openPresetSheetSpy.mockReset();
    useDatasetTableStateMock.mockReset();
    viewSwitchGridSpy.mockReset();
    trackAppEventMock.mockReset();
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      datasetCountryNames: [],
      availableCountryNames: [],
      getSortedRows: () => [],
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
      onOpenOpenPreset?: () => void;
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
    expect(actionBarProps.onOpenOpenPreset).toBeUndefined();
    expect(openPresetSheetSpy).not.toHaveBeenCalled();
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

  it("passes the source row count into shared table state", () => {
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
        sourceRowCount={12507}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      sourceRowCount?: number | null;
    };

    expect(datasetTableStateProps.sourceRowCount).toBe(12507);
  });

  it("does not rerender the filter rail when only sorting changes", () => {
    const dataset = {
      ...datasetBase,
      columns: [
        {
          key: "geo_country_name",
          label: "Geo_Country_Name",
          sourceIndex: 0,
        },
      ],
    };
    const regions: ReturnType<typeof createFilterRegions> = [];
    const fieldDefinitionPresentationByColumnKey = {};
    const baseTableState = {
      table: {} as never,
      visibleColumns: [],
      datasetCountryNames: [] as string[],
      availableCountryNames: [] as string[],
      getSortedRows: () => [],
      recordCount: 2,
      isLoading: false,
      error: null,
    };

    useDatasetTableStateMock.mockReset();
    useDatasetTableStateMock
      .mockReturnValueOnce({
        ...baseTableState,
        sorting: [],
      })
      .mockReturnValueOnce({
        ...baseTableState,
        sorting: [{ id: "geo_country_name", desc: true }],
      });

    const { rerender } = render(
      <DatasetDetailClient
        dataset={dataset}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
      />,
    );

    const initialRenderCount = viewSwitchGridSpy.mock.calls.length;

    rerender(
      <DatasetDetailClient
        dataset={dataset}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
      />,
    );

    expect(viewSwitchGridSpy).toHaveBeenCalledTimes(initialRenderCount);
  });

  it("wires the admin-only open preset sheet from the action bar trigger", () => {
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
          tags: [
            {
              id: "tag-1",
              label: "Watchlist",
              color: "#262531",
            },
          ],
        }}
        regions={[]}
        fieldDefinitionPresentationByColumnKey={{}}
        canManageOpenPresets
      />,
    );

    const actionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      onOpenOpenPreset?: () => void;
    };
    const initialSheetProps = openPresetSheetSpy.mock.lastCall?.[0] as {
      open: boolean;
      selectedTagId: string | null;
      tags: Array<{ id: string }>;
    };

    expect(actionBarProps.onOpenOpenPreset).toEqual(expect.any(Function));
    expect(initialSheetProps.open).toBe(false);
    expect(initialSheetProps.selectedTagId).toBe("tag-1");
    expect(initialSheetProps.tags).toEqual([
      expect.objectContaining({ id: "tag-1" }),
    ]);

    act(() => {
      actionBarProps.onOpenOpenPreset?.();
    });

    const updatedSheetProps = openPresetSheetSpy.mock.lastCall?.[0] as {
      open: boolean;
    };

    expect(updatedSheetProps.open).toBe(true);
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

  it("selects Global by default and uses it for region filtering", () => {
    const regions = [
      {
        id: "f1000000-0000-4000-8000-000000000001",
        name: "Global",
        description: "",
        sortOrder: 1,
        countries: ["India", "Nepal"],
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
        supported: boolean;
        selectors: Array<{ id: string; label: string; checked: boolean }>;
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
      supported: true,
      selectors: [
        {
          id: "f1000000-0000-4000-8000-000000000001",
          label: "Global",
          checked: true,
        },
        {
          id: "f1000000-0000-4000-8000-000000000002",
          label: "South Asia",
          checked: false,
        },
      ],
    });
    expect(datasetTableStateProps.regionFilter).toEqual({
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India", "Nepal"],
    });
    expect(actionBarProps.filters.region).toEqual({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
      enabledCountryNames: ["India", "Nepal"],
    });
  });

  it("shows all countries as checked when Global is active by default", () => {
    mockCountrySyncTableState();

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
        regions={createFilterRegions()}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };

    expect(viewSwitchGridProps.countryCard).toMatchObject({
      selectedCountries: ["Brazil", "India", "Nepal", "Peru"],
      hasExplicitSelection: false,
    });
  });

  it("turns Region off when a country is removed from the Global selection", () => {
    const regions = createFilterRegions();
    regions[0] = {
      ...regions[0],
      countries: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    };
    mockCountrySyncTableState({
      availableCountryNames: ["India", "Nepal", "Brazil", "Peru"],
      datasetCountryNames: ["India", "Nepal", "Brazil", "Peru"],
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
          ],
        }}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      viewSwitchGridProps.countryCard.onToggleCountry("Peru", false);
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
      countryFilter: {
        enabled: boolean;
        selectedCountryNames: string[];
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
        country: {
          enabled: boolean;
          selectedCountryNames: string[];
        };
      };
    };

    expect(latestDatasetTableStateProps.regionFilter).toMatchObject({
      enabled: false,
      enabledCountryNames: [],
    });
    expect(latestDatasetTableStateProps.countryFilter).toMatchObject({
      enabled: true,
      selectedCountryNames: ["Brazil", "India", "Nepal"],
    });
    expect(latestActionBarProps.filters.region).toEqual({
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
      enabledCountryNames: [],
    });
    expect(latestActionBarProps.filters.country).toEqual({
      enabled: true,
      selectedCountryNames: ["Brazil", "India", "Nepal"],
      includeAlternateCountries: false,
    });
  });

  it("restores Global when the last dataset country is reselected", () => {
    const regions = createFilterRegions();
    regions[0] = {
      ...regions[0],
      countries: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    };
    mockCountrySyncTableState({
      availableCountryNames: ["India", "Nepal", "Brazil", "Peru"],
      datasetCountryNames: ["India", "Nepal", "Brazil", "Peru"],
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
          ],
        }}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    let latestViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      latestViewSwitchGridProps.countryCard.onToggleCountry("Peru", false);
    });

    latestViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      latestViewSwitchGridProps.countryCard.onToggleCountry("Peru", true);
    });

    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
      };
    };
    const latestCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };

    expect(latestActionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
    });
    expect(latestCountryViewSwitchGridProps.countryCard).toMatchObject({
      selectedCountries: ["Brazil", "India", "Nepal", "Peru"],
      hasExplicitSelection: false,
    });
  });

  it("restores Global when country Select all is applied from a custom subset", () => {
    const regions = createFilterRegions();
    regions[0] = {
      ...regions[0],
      countries: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    };
    mockCountrySyncTableState({
      availableCountryNames: ["India", "Nepal", "Brazil", "Peru"],
      datasetCountryNames: ["India", "Nepal", "Brazil", "Peru"],
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
          ],
        }}
        regions={regions}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      initialCountryViewSwitchGridProps.countryCard.onToggleCountry("Peru", false);
    });

    const latestViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onSelectVisible: (countryNames: string[]) => void;
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };

    act(() => {
      latestViewSwitchGridProps.countryCard.onSelectVisible([
        "Brazil",
        "India",
        "Nepal",
        "Peru",
      ]);
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
      };
    };
    const latestCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };

    expect(latestDatasetTableStateProps.regionFilter).toMatchObject({
      enabled: true,
      enabledCountryNames: ["Brazil", "India", "Mexico", "Nepal", "Peru"],
    });
    expect(latestActionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
    });
    expect(latestCountryViewSwitchGridProps.countryCard).toMatchObject({
      selectedCountries: ["Brazil", "India", "Nepal", "Peru"],
      hasExplicitSelection: false,
    });
  });

  it("snaps the checked countries to the selected region union", () => {
    mockCountrySyncTableState();

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
        regions={createFilterRegions()}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      viewSwitchGridProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        true,
      );
    });

    const latestViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };
    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
    };

    expect(latestDatasetTableStateProps.regionFilter).toMatchObject({
      enabled: true,
      enabledCountryNames: ["India", "Nepal"],
    });
    expect(latestViewSwitchGridProps.countryCard).toMatchObject({
      selectedCountries: ["India", "Nepal"],
      hasExplicitSelection: false,
    });
  });

  it("turns South Asia off when countries are changed to a non-matching custom subset", () => {
    mockCountrySyncTableState();

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
        regions={createFilterRegions()}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialRegionViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      initialRegionViewSwitchGridProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        true,
      );
    });

    const latestCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      latestCountryViewSwitchGridProps.countryCard.onToggleCountry("Brazil", true);
    });

    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
      };
    };

    expect(latestActionBarProps.filters.region).toMatchObject({
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
    });
  });

  it("matches the exact non-global region combination when countries align", () => {
    mockCountrySyncTableState({
      availableCountryNames: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
      datasetCountryNames: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    });
    const regions = createFilterRegions();

    regions[0] = {
      ...regions[0],
      countries: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    };

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

    const latestCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      latestCountryViewSwitchGridProps.countryCard.onToggleCountry("Mexico", false);
    });

    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
      };
    };

    expect(latestActionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: [
        "f1000000-0000-4000-8000-000000000002",
        "f1000000-0000-4000-8000-000000000003",
      ],
      selectedRegionNames: ["South Asia", "Latin America"],
    });
  });

  it("restores the region-driven country union after a custom country state", () => {
    mockCountrySyncTableState();

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
        regions={createFilterRegions()}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialCountryViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      initialCountryViewSwitchGridProps.countryCard.onToggleCountry("Peru", false);
    });

    const regionViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      regionViewSwitchGridProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        true,
      );
    });

    const latestCountrySelectionViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
      };
    };

    expect(latestCountrySelectionViewSwitchGridProps.countryCard).toMatchObject({
      selectedCountries: ["India", "Nepal"],
      hasExplicitSelection: false,
    });
  });

  it("passes country filter state into the card, shared table state, and action bar", () => {
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      datasetCountryNames: ["Egypt", "Jordan"],
      availableCountryNames: ["Egypt", "Jordan"],
      getSortedRows: () => [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            Geo_Country_Name: "Jordan",
          },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: {
            Geo_Country_Name: "Egypt",
            Alternate_Countries: "Turkey",
          },
        },
      ],
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
        visibleCountries: string[];
        selectedCountries: string[];
        hasExplicitSelection?: boolean;
        includeAlternateCountries: boolean;
        supportsAlternateCountries: boolean;
        onEnabledChange: (enabled: boolean) => void;
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    expect(initialViewSwitchGridProps.countryCard).toMatchObject({
      enabled: false,
      supported: true,
      availableCountries: ["Egypt", "Jordan"],
      visibleCountries: ["Egypt", "Jordan"],
      selectedCountries: ["Egypt", "Jordan"],
      hasExplicitSelection: false,
      includeAlternateCountries: false,
      supportsAlternateCountries: true,
    });

    act(() => {
      initialViewSwitchGridProps.countryCard.onEnabledChange(true);
      initialViewSwitchGridProps.countryCard.onToggleCountry("Jordan", false);
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      countryFilter: {
        enabled: boolean;
        isSupported: boolean;
        selectedCountryNames: string[];
        includeAlternateCountries: boolean;
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        country: {
          enabled: boolean;
          selectedCountryNames: string[];
          includeAlternateCountries?: boolean;
        };
      };
    };

    expect(latestDatasetTableStateProps.countryFilter).toEqual({
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Egypt"],
      includeAlternateCountries: false,
    });
    expect(latestActionBarProps.filters.country).toEqual({
      enabled: true,
      selectedCountryNames: ["Egypt"],
      includeAlternateCountries: false,
    });
  });

  it("defaults legacy presets to primary-country-only matching", () => {
    useDatasetTableStateMock.mockImplementation((props: {
      countryFilter: {
        includeAlternateCountries: boolean;
      };
    }) => ({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      datasetCountryNames: props.countryFilter.includeAlternateCountries
        ? ["Egypt", "Jordan", "Turkey"]
        : ["Egypt", "Jordan"],
      availableCountryNames: props.countryFilter.includeAlternateCountries
        ? ["Egypt", "Jordan", "Turkey"]
        : ["Egypt", "Jordan"],
      getSortedRows: () => [],
      recordCount: 2,
      isLoading: false,
      error: null,
    }));

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
        initialFilters={createInitialFilters({
          country: {
            enabled: true,
            selectedCountryNames: ["Turkey"],
          },
        })}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      countryFilter: {
        enabled: boolean;
        isSupported: boolean;
        includeAlternateCountries: boolean;
        selectedCountryNames: string[];
      };
    };
    const actionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        country: {
          enabled: boolean;
          includeAlternateCountries?: boolean;
          selectedCountryNames: string[];
        };
      };
    };

    expect(datasetTableStateProps.countryFilter).toEqual({
      enabled: true,
      isSupported: true,
      includeAlternateCountries: false,
      selectedCountryNames: [],
    });
    expect(actionBarProps.filters.country).toEqual({
      enabled: true,
      includeAlternateCountries: false,
      selectedCountryNames: [],
    });
  });

  it("prunes alternate-only country selections when alternate-country matching is turned off", () => {
    useDatasetTableStateMock.mockImplementation((props: {
      countryFilter: {
        includeAlternateCountries: boolean;
      };
    }) => ({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      datasetCountryNames: props.countryFilter.includeAlternateCountries
        ? ["Egypt", "Jordan", "Turkey"]
        : ["Egypt", "Jordan"],
      availableCountryNames: props.countryFilter.includeAlternateCountries
        ? ["Egypt", "Jordan", "Turkey"]
        : ["Egypt", "Jordan"],
      getSortedRows: () => [],
      recordCount: 2,
      isLoading: false,
      error: null,
    }));

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
        onEnabledChange: (enabled: boolean) => void;
        onIncludeAlternateCountriesChange: (enabled: boolean) => void;
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      initialViewSwitchGridProps.countryCard.onIncludeAlternateCountriesChange(true);
    });

    const enabledViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onEnabledChange: (enabled: boolean) => void;
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      enabledViewSwitchGridProps.countryCard.onEnabledChange(true);
      enabledViewSwitchGridProps.countryCard.onToggleCountry("Egypt", false);
    });

    const narrowedViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onToggleCountry: (countryName: string, checked: boolean) => void;
      };
    };

    act(() => {
      narrowedViewSwitchGridProps.countryCard.onToggleCountry("Jordan", false);
    });

    let latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      countryFilter: {
        enabled: boolean;
        isSupported: boolean;
        includeAlternateCountries: boolean;
        selectedCountryNames: string[];
      };
    };

    expect(latestDatasetTableStateProps.countryFilter).toEqual({
      enabled: true,
      isSupported: true,
      includeAlternateCountries: true,
      selectedCountryNames: ["Turkey"],
    });

    const alternateToggleProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      countryCard: {
        onIncludeAlternateCountriesChange: (enabled: boolean) => void;
      };
    };

    act(() => {
      alternateToggleProps.countryCard.onIncludeAlternateCountriesChange(false);
    });

    latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      countryFilter: {
        enabled: boolean;
        isSupported: boolean;
        includeAlternateCountries: boolean;
        selectedCountryNames: string[];
      };
    };
    const latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        country: {
          enabled: boolean;
          includeAlternateCountries?: boolean;
          selectedCountryNames: string[];
        };
      };
    };

    expect(latestDatasetTableStateProps.countryFilter).toEqual({
      enabled: true,
      isSupported: true,
      includeAlternateCountries: false,
      selectedCountryNames: [],
    });
    expect(latestActionBarProps.filters.country).toEqual({
      enabled: true,
      includeAlternateCountries: false,
      selectedCountryNames: [],
    });
  });

  it("uses exclusive Global selector behavior and restores Global when the last specific region turns off", () => {
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
            id: "f1000000-0000-4000-8000-000000000001",
            name: "Global",
            description: "",
            sortOrder: 1,
            countries: ["India", "Nepal"],
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
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    const initialViewSwitchGridProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      initialViewSwitchGridProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        true,
      );
    });

    let latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
        isSupported: boolean;
        hasConfiguredRegions: boolean;
        enabledCountryNames: string[];
      };
    };
    let latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
      };
    };

    expect(latestDatasetTableStateProps.regionFilter).toEqual({
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India"],
    });
    expect(latestActionBarProps.filters.region).toEqual({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000002"],
      selectedRegionNames: ["South Asia"],
      enabledCountryNames: ["India"],
    });

    const specificRegionProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      specificRegionProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000001",
        true,
      );
    });

    latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
      };
    };

    expect(latestActionBarProps.filters.region).toEqual({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
      enabledCountryNames: ["India", "Nepal"],
    });

    const selectedSpecificRegionProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      selectedSpecificRegionProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        true,
      );
    });

    const selectedRegionProps = viewSwitchGridSpy.mock.lastCall?.[0] as {
      regionCard: {
        onSelectorChange: (regionId: string, checked: boolean) => void;
      };
    };

    act(() => {
      selectedRegionProps.regionCard.onSelectorChange(
        "f1000000-0000-4000-8000-000000000002",
        false,
      );
    });

    latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      regionFilter: {
        enabled: boolean;
        isSupported: boolean;
        hasConfiguredRegions: boolean;
        enabledCountryNames: string[];
      };
    };
    latestActionBarProps = actionBarSpy.mock.lastCall?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
          enabledCountryNames: string[];
        };
      };
    };

    expect(latestDatasetTableStateProps.regionFilter).toEqual({
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India", "Nepal"],
    });
    expect(latestActionBarProps.filters.region).toEqual({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
      enabledCountryNames: ["India", "Nepal"],
    });
  });

  it("passes supported watchlist filter state into the card, shared table state, and action bar", () => {
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [{ id: "christianity_gsec", desc: false }],
      visibleColumns: [],
      datasetCountryNames: [],
      availableCountryNames: [],
      getSortedRows: () => [],
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
        populationBelieversRuleLabel: string;
        populationBelieversRuleDefinition: string;
        populationBelieversRuleEnabled: boolean;
        populationBelieversRule: {
          tiers: Array<{
            minPopulation: number;
            maxPopulation: number | null;
            minBelievers: number;
          }>;
        };
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
        evangelicalPopulationBelieversRuleEnabled: boolean;
        evangelicalPopulationBelieversRule: {
          tiers: Array<{
            minPopulation: number;
            maxPopulation: number | null;
            minBelievers: number;
          }>;
        };
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
          evangelicalPopulationBelieversRuleEnabled?: boolean;
          evangelicalPopulationBelieversRule?: {
            tiers: Array<{
              minPopulation: number;
              maxPopulation: number | null;
              minBelievers: number;
            }>;
          };
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
      populationBelieversRuleLabel: "Population vs Evangelical Believers",
      populationBelieversRuleDefinition:
        "Build a tiered minimum-believers rule by population. Actual believers are calculated as People Group: Population * (Percent Evangelical PGAC / 100), and the implied percentage is shown live for context.",
      populationBelieversRuleEnabled: true,
      populationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
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
      evangelicalPopulationBelieversRuleEnabled: true,
      evangelicalPopulationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
      frontierGroupEnabled: true,
      frontierGroupValue: true,
    });
    expect(actionBarProps.filters.watchlist).toEqual({
      enabled: false,
      thresholdEnabled: true,
      threshold: 2,
      engagementPhaseEnabled: true,
      engagementPhaseThreshold: 6,
      evangelicalPopulationBelieversRuleEnabled: true,
      evangelicalPopulationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
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

  it("sanitizes the population-believers rule when it changes", () => {
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
        onPopulationBelieversRuleChange: (value: {
          tiers: Array<{
            minPopulation: number;
            maxPopulation: number | null;
            minBelievers: number;
          }>;
        }) => void;
      };
    };

    act(() => {
      initialViewSwitchGridProps.watchlistCard.onPopulationBelieversRuleChange({
        tiers: [
          {
            minPopulation: 4_000,
            maxPopulation: 8_000,
            minBelievers: 60,
          },
          {
            minPopulation: 9_000,
            maxPopulation: null,
            minBelievers: 120,
          },
        ],
      });
    });

    const latestDatasetTableStateProps = useDatasetTableStateMock.mock.lastCall?.[0] as {
      watchlistFilter: {
        evangelicalPopulationBelieversRule: {
          tiers: Array<{
            minPopulation: number;
            maxPopulation: number | null;
            minBelievers: number;
          }>;
        };
      };
    };

    expect(
      latestDatasetTableStateProps.watchlistFilter.evangelicalPopulationBelieversRule,
    ).toEqual({
      tiers: [
        {
          minPopulation: 0,
          maxPopulation: 8_000,
          minBelievers: 60,
        },
        {
          minPopulation: 8_001,
          maxPopulation: null,
          minBelievers: 120,
        },
      ],
    });
  });

  it("maps a legacy disabled preset to the default Global selection", () => {
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
            id: "f1000000-0000-4000-8000-000000000001",
            name: "Global",
            description: "",
            sortOrder: 1,
            countries: ["India", "Nepal"],
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
      enabled: true,
      enabledCountryNames: ["India", "Nepal"],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
    });
  });

  it("hydrates legacy Globe saved-view names to the current Global selector and restores initial sorting", () => {
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
            id: "f1000000-0000-4000-8000-000000000001",
            name: "Global",
            description: "",
            sortOrder: 1,
            countries: ["India", "Nepal"],
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
        ]}
        fieldDefinitionPresentationByColumnKey={{}}
        initialFilters={createInitialFilters({
          region: {
            enabled: true,
            selectedRegionIds: ["missing-region-id"],
            selectedRegionNames: ["Globe"],
            enabledCountryNames: ["India", "Nepal"],
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
      enabledCountryNames: ["India", "Nepal"],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Global"],
    });
  });

  it("preserves a saved custom country subset with Region off", () => {
    mockCountrySyncTableState();

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
        regions={createFilterRegions()}
        fieldDefinitionPresentationByColumnKey={{}}
        initialFilters={createInitialFilters({
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
        })}
      />,
    );

    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      regionFilter: {
        enabled: boolean;
        enabledCountryNames: string[];
      };
      countryFilter: {
        enabled: boolean;
        selectedCountryNames: string[];
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
        country: {
          enabled: boolean;
          selectedCountryNames: string[];
        };
      };
    };

    expect(datasetTableStateProps.regionFilter).toMatchObject({
      enabled: false,
      enabledCountryNames: [],
    });
    expect(datasetTableStateProps.countryFilter).toMatchObject({
      enabled: true,
      selectedCountryNames: ["India"],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
    });
    expect(actionBarProps.filters.country).toMatchObject({
      enabled: true,
      selectedCountryNames: ["India"],
    });
  });

  it("turns Region off when a saved view no longer matches any configured region", () => {
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
            id: "f1000000-0000-4000-8000-000000000001",
            name: "Global",
            description: "",
            sortOrder: 1,
            countries: ["India", "Nepal"],
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
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        region: {
          enabled: boolean;
          selectedRegionIds: string[];
          selectedRegionNames: string[];
        };
      };
    };

    expect(datasetTableStateProps.regionFilter).toMatchObject({
      enabled: false,
      enabledCountryNames: [],
    });
    expect(actionBarProps.filters.region).toMatchObject({
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
    });
  });
});
