// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFound, redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
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
    tags: [
      {
        id: "tag-1",
        label: "Watchlist",
        color: "#262531",
        openPreset: {
          region: {
            enabled: false,
            selectedRegionIds: [],
            selectedRegionNames: [],
            enabledCountryNames: [],
          },
            country: {
              enabled: false,
              selectedCountryNames: [],
              includeAlternateCountries: false,
            },
          watchlist: {
            enabled: true,
            threshold: 2,
            engagementPhaseThreshold: 6,
            evangelicalBelieversThreshold: 50,
            evangelicalPercentThreshold: 0.05,
            frontierGroupValue: true,
          },
          uupg: {
            enabled: false,
          },
        },
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
          selectedRegionNames: ["South Asia"],
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
      canManageOpenPresets?: boolean;
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
        selectedRegionNames: ["South Asia"],
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
      },
    });
    expect(props.initialSorting).toEqual([
      {
        id: "geo_country_name",
        desc: true,
      },
    ]);
    expect(props.canManageOpenPresets).toBe(true);
    expect(props.actorOwnerId).toBe("owner-1");
    expect(props.workspaceRole).toBe("admin");
    expect(props.datasetSource).toBe("dashboard");
    expect(props.sourceRowCount).toBe(10);
    expect(props.initialSavedTableId).toBe("saved-table-1");
    expect(props.initialSavedTableRowCount).toBe(10);
  });

  it("keeps tag preset hydration for viewers while hiding open preset management", async () => {
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
      initialFilters: { watchlist: { enabled: boolean } };
      canManageOpenPresets?: boolean;
      workspaceRole: string;
      initialPresetTagId: string | null;
    };

    expect(props.initialFilters.watchlist.enabled).toBe(true);
    expect(props.canManageOpenPresets).toBe(false);
    expect(props.workspaceRole).toBe("viewer");
    expect(props.initialPresetTagId).toBe("tag-1");
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
      initialPresetTagId: string | null;
    };

    expect(props.datasetSource).toBe("default_redirect");
    expect(props.initialPresetTagId).toBe("tag-1");
  });

  it("passes the backing source row count to the dataset detail client for derived datasets", async () => {
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
    };

    expect(props.dataset).toMatchObject({
      id: "dataset-derived",
      backingDatasetId: "dataset-source",
    });
    expect(props.sourceRowCount).toBe(12507);
  });

  it("falls back to the dataset tag preset when the saved table targets another dataset", async () => {
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
          selectedRegionNames: ["South Asia"],
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
      initialFilters: { watchlist: { enabled: boolean } };
      initialSorting?: unknown;
    };

    expect(props.initialFilters.watchlist.enabled).toBe(true);
    expect(props.initialSorting).toBeUndefined();
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
