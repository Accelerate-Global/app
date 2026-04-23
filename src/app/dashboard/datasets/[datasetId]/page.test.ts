// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFound, redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getDataset, listDatasets } from "@/lib/datasets";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { getDatasetViewOption } from "@/lib/dataset-view-options";
import { listFilterRegions } from "@/lib/filter-settings";
import { getSavedDatasetTable } from "@/lib/saved-dataset-tables";
import DatasetPage from "./page";

const datasetDetailClientSpy = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getDataset: vi.fn(),
  listDatasets: vi.fn(),
}));

vi.mock("@/lib/field-definitions", () => ({
  listFieldDefinitionPresentationByColumnKey: vi.fn(),
}));

vi.mock("@/lib/dataset-view-options", () => ({
  getDatasetViewOption: vi.fn(),
}));

vi.mock("@/lib/filter-settings", () => ({
  listFilterRegions: vi.fn(),
}));

vi.mock("@/lib/saved-dataset-tables", () => ({
  getSavedDatasetTable: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/dataset-detail-client", () => ({
  DatasetDetailClient: (props: unknown) => {
    datasetDetailClientSpy(props);
    return null;
  },
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);
const listDatasetsMock = vi.mocked(listDatasets);
const listFieldDefinitionPresentationByColumnKeyMock = vi.mocked(
  listFieldDefinitionPresentationByColumnKey,
);
const getDatasetViewOptionMock = vi.mocked(getDatasetViewOption);
const listFilterRegionsMock = vi.mocked(listFilterRegions);
const getSavedDatasetTableMock = vi.mocked(getSavedDatasetTable);
const redirectMock = vi.mocked(redirect);
const notFoundMock = vi.mocked(notFound);

function createDataset() {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    isPublic: true,
    status: "ready" as const,
    rowCount: 10,
    sizeBytes: 100,
    columns: [
      {
        key: "geo_country_name",
        label: "Geo_Country_Name",
        sourceIndex: 0,
      },
    ],
    hiddenColumnKeys: [],
    defaultFilters: null,
    tags: [
      {
        id: "tag-1",
        label: "Watchlist",
        color: "#262531",
      },
    ],
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("/dashboard/datasets/[datasetId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    datasetDetailClientSpy.mockReset();
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    getDatasetMock.mockResolvedValue(createDataset());
    listDatasetsMock.mockResolvedValue([createDataset()]);
    listFieldDefinitionPresentationByColumnKeyMock.mockResolvedValue({});
    getDatasetViewOptionMock.mockReturnValue({
      id: "global",
      title: "Global",
      description:
        "Contains all unique people groups from IMB, Joshua Project, Accelerate, Etnopedia, and World Christian Database.",
      defaultChecked: true,
      aliases: ["global"],
    });
    listFilterRegionsMock.mockResolvedValue([]);
    getSavedDatasetTableMock.mockResolvedValue(null);
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(
      DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("hydrates matching saved-table filters and sorting", async () => {
    getSavedDatasetTableMock.mockResolvedValue({
      id: "saved-table-1",
      datasetId: "dataset-1",
      datasetFileName: "Global",
      name: "Saved view",
      details: "",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["region-1"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India"],
        },
          country: {
            enabled: false,
            selectedCountryNames: [],
            includeAlternateCountries: false,
          },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
          evangelicalBelieversThreshold: 50,
          evangelicalPercentThreshold: 0.05,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [
          {
            id: "geo_country_name",
            desc: true,
          },
        ],
      },
      savedRowCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({ savedTableId: "saved-table-1" }),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      initialFilters: unknown;
      initialSorting?: unknown;
      assignableDatasets?: Array<{ id: string }>;
      actorOwnerId: string;
      workspaceRole: string;
      datasetSource: string;
      sourceRowCount: number;
      initialSavedTableId: string | null;
      initialSavedTableRowCount: number | null;
    };

    expect(getSavedDatasetTableMock).toHaveBeenCalledWith({
      ownerId: "owner-1",
      savedTableId: "saved-table-1",
    });
    expect(props.initialFilters).toEqual({
      region: {
        enabled: true,
        selectedRegionIds: ["region-1"],
        selectedRegionNames: ["Asia, South"],
        enabledCountryNames: ["India"],
      },
      country: {
        enabled: false,
        selectedCountryNames: [],
        includeAlternateCountries: false,
      },
      watchlist: expect.objectContaining({
        enabled: false,
        threshold: 2,
      }),
      uupg: {
        enabled: false,
        globalEngagementAnywhereEnabled: true,
        frontierGroupEnabled: true,
      },
      hotspots: {
        enabled: false,
        metric: "unique_uupgs",
        countryCount: 10,
      },
    });
    expect(props.initialSorting).toEqual([
      {
        id: "geo_country_name",
        desc: true,
      },
    ]);
    expect(props.assignableDatasets).toEqual([]);
    expect(props.actorOwnerId).toBe("owner-1");
    expect(props.workspaceRole).toBe("admin");
    expect(props.datasetSource).toBe("dashboard");
    expect(props.sourceRowCount).toBe(10);
    expect(props.initialSavedTableId).toBe("saved-table-1");
    expect(props.initialSavedTableRowCount).toBe(10);
  });

  it("does not hydrate default filters for viewers when none are configured", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: "Viewer",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      initialFilters: unknown;
      assignableDatasets?: Array<{ id: string }>;
      workspaceRole: string;
    };

    expect(props.initialFilters).toBeNull();
    expect(props.assignableDatasets).toEqual([]);
    expect(props.workspaceRole).toBe("viewer");
    expect(getDatasetMock).toHaveBeenCalledWith("dataset-1", {
      includeDisabled: false,
    });
  });

  it("passes through explicit dataset source analytics props", async () => {
    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({ source: "default_redirect" }),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      datasetSource: string;
    };

    expect(props.datasetSource).toBe("default_redirect");
  });

  it("renders a static page heading regardless of the dataset name", async () => {
    getDatasetMock.mockResolvedValue({
      ...createDataset(),
      fileName: "All People Groups",
    });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "PGAC Dataset" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { level: 1, name: "All People Groups" }),
    ).toBeNull();
  });

  it("passes the backing source row count to the dataset detail client for derived datasets", async () => {
    listDatasetsMock.mockResolvedValue([
      {
        ...createDataset(),
        id: "dataset-derived",
        backingDatasetId: "dataset-source",
        fileName: "South Asia",
        rowCount: 128,
        isPrimary: false,
      },
      {
        ...createDataset(),
        id: "dataset-source",
        backingDatasetId: null,
        fileName: "All People Groups",
        rowCount: 12507,
      },
      {
        ...createDataset(),
        id: "dataset-target",
        backingDatasetId: null,
        fileName: "Latin America",
        isPrimary: false,
      },
    ]);
    getDatasetMock
      .mockResolvedValueOnce({
        ...createDataset(),
        id: "dataset-derived",
        backingDatasetId: "dataset-source",
        rowCount: 128,
        isPrimary: false,
      })
      .mockResolvedValueOnce({
        ...createDataset(),
        id: "dataset-source",
        backingDatasetId: null,
        rowCount: 12507,
      });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-derived" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      sourceRowCount: number;
      dataset: { id: string; backingDatasetId: string | null };
      assignableDatasets: Array<{ id: string }>;
    };

    expect(props.dataset).toMatchObject({
      id: "dataset-derived",
      backingDatasetId: "dataset-source",
    });
    expect(props.assignableDatasets).toEqual([
      expect.objectContaining({ id: "dataset-derived" }),
      expect.objectContaining({ id: "dataset-target" }),
    ]);
    expect(props.sourceRowCount).toBe(12507);
    expect(getDatasetMock).toHaveBeenNthCalledWith(1, "dataset-derived", {
      includeDisabled: true,
    });
    expect(getDatasetMock).toHaveBeenNthCalledWith(2, "dataset-source", {
      includeDisabled: true,
    });
  });

  it("ignores a saved table from another dataset when no dataset defaults exist", async () => {
    getSavedDatasetTableMock.mockResolvedValue({
      id: "saved-table-1",
      datasetId: "dataset-2",
      datasetFileName: "Other Dataset",
      name: "Saved view",
      details: "",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["region-1"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
          includeAlternateCountries: false,
        },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
          evangelicalBelieversThreshold: 50,
          evangelicalPercentThreshold: 0.05,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
      savedRowCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({ savedTableId: "saved-table-1" }),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      initialFilters: unknown;
      initialSorting?: unknown;
    };

    expect(props.initialFilters).toBeNull();
    expect(props.initialSorting).toBeUndefined();
  });

  it("passes dataset default filters and sorting through to the detail client", async () => {
    getDatasetMock.mockResolvedValue({
      ...createDataset(),
      defaultFilters: {
        region: {
          enabled: true,
          selectedRegionIds: ["region-1"],
          selectedRegionNames: ["Asia, South"],
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
            id: "geo_country_name",
            desc: true,
          },
        ],
      },
    });

    render(
      await DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const props = datasetDetailClientSpy.mock.lastCall?.[0] as {
      initialFilters: { region: { enabled: boolean } };
      initialSorting?: Array<{ id: string; desc: boolean }>;
    };

    expect(props.initialFilters.region.enabled).toBe(true);
    expect(props.initialSorting).toEqual([
      {
        id: "geo_country_name",
        desc: true,
      },
    ]);
  });

  it("renders not found when the dataset does not exist", async () => {
    getDatasetMock.mockResolvedValue(null);

    await expect(
      DatasetPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
