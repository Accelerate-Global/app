// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDatasetRowsCache } from "@/components/dashboard/dataset-row-cache";
import type {
  DatasetCountryFilterState,
  DatasetRegionFilterState,
} from "@/lib/dataset-region-filtering";
import { DashboardClient } from "./dashboard-client";
import { useDatasetTableState } from "./use-dataset-table-state";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: vi.fn(),
}));

function createDataset(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    status: "ready" as const,
    rowCount: 2,
    sizeBytes: 4096,
    columns: [
      {
        key: "people_group_id",
        label: "People Group ID",
        sourceIndex: 0,
      },
      {
        key: "country",
        label: "Country",
        sourceIndex: 1,
      },
    ],
    hiddenColumnKeys: [],
    tags: [],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createDeferredResponse(payload: unknown) {
  let resolveResponse: (() => void) | null = null;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = () => resolve(buildJsonResponse(payload));
  });

  return {
    promise,
    resolve() {
      resolveResponse?.();
    },
  };
}

function DatasetTableStateProbe({
  dataset,
  regionFilter,
  countryFilter,
}: {
  dataset: ReturnType<typeof createDataset>;
  regionFilter?: DatasetRegionFilterState;
  countryFilter?: DatasetCountryFilterState;
}) {
  const state = useDatasetTableState({
    dataset,
    regionFilter,
    countryFilter,
  });

  return (
    <div>
      <div data-testid="record-count">{state.recordCount}</div>
      <div data-testid="loading">{String(state.isLoading)}</div>
      <div data-testid="available-countries">
        {state.availableCountryNames.join(",")}
      </div>
      <div data-testid="dataset-country-names">
        {state.datasetCountryNames.join(",")}
      </div>
    </div>
  );
}

describe("useDatasetTableState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearDatasetRowsCache();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shares one in-flight fetch between dashboard preload and dataset detail", async () => {
    const deferred = createDeferredResponse({
      sourceDatasetId: "primary-dataset",
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            people_group_id: "PG-1",
            country: "Egypt",
          },
        },
      ],
      page: 1,
      pageSize: 1000,
      totalRows: 1,
      pageCount: 1,
    });

    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/datasets/primary-dataset/rows?page=1&pageSize=1000") {
        return deferred.promise;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(
      <DashboardClient
        initialDatasets={[createDataset({ id: "primary-dataset" })]}
        initialSavedTables={[]}
        canManageDatasets={false}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    render(
      <DatasetTableStateProbe
        dataset={createDataset({
          id: "watchlist-dataset",
          backingDatasetId: "primary-dataset",
          isPrimary: false,
        })}
      />,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve();

    await waitFor(() => {
      expect(screen.getByTestId("record-count").textContent).toBe("1");
    });
  });

  it("reuses warmed rows when switching between derived datasets with the same backing source", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/datasets/watchlist-dataset/rows?page=1&pageSize=1000") {
        return buildJsonResponse({
          sourceDatasetId: "primary-dataset",
          rows: [
            {
              id: "row-1",
              rowIndex: 0,
              data: {
                people_group_id: "PG-1",
                country: "Egypt",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 1,
          pageCount: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const { rerender } = render(
      <DatasetTableStateProbe
        dataset={createDataset({
          id: "watchlist-dataset",
          backingDatasetId: "primary-dataset",
          isPrimary: false,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("record-count").textContent).toBe("1");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(
      <DatasetTableStateProbe
        dataset={createDataset({
          id: "uupg-dataset",
          backingDatasetId: "primary-dataset",
          isPrimary: false,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("record-count").textContent).toBe("1");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches standalone uploaded datasets independently", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/datasets/uploaded-a/rows?page=1&pageSize=1000") {
        return buildJsonResponse({
          sourceDatasetId: "uploaded-a",
          rows: [
            {
              id: "row-a",
              rowIndex: 0,
              data: {
                people_group_id: "PG-A",
                country: "Brazil",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 1,
          pageCount: 1,
        });
      }

      if (input === "/api/datasets/uploaded-b/rows?page=1&pageSize=1000") {
        return buildJsonResponse({
          sourceDatasetId: "uploaded-b",
          rows: [
            {
              id: "row-b",
              rowIndex: 0,
              data: {
                people_group_id: "PG-B",
                country: "Nepal",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 1,
          pageCount: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const { rerender } = render(
      <DatasetTableStateProbe
        dataset={createDataset({
          id: "uploaded-a",
          fileName: "Uploaded A.csv",
          isPrimary: false,
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("record-count").textContent).toBe("1");
    });

    rerender(
      <DatasetTableStateProbe
        dataset={createDataset({
          id: "uploaded-b",
          fileName: "Uploaded B.csv",
          isPrimary: false,
        })}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("builds visible country options before applying the country filter", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/datasets/dataset-1/rows?page=1&pageSize=1000") {
        return buildJsonResponse({
          sourceDatasetId: "dataset-1",
          rows: [
            {
              id: "row-1",
              rowIndex: 0,
              data: {
                geo_country_name: "Jordan",
                alternate_countries: "Turkey",
              },
            },
            {
              id: "row-2",
              rowIndex: 1,
              data: {
                geo_country_name: "Egypt",
                alternate_countries: "Jordan; Libya",
              },
            },
            {
              id: "row-3",
              rowIndex: 2,
              data: {
                geo_country_name: "Brazil",
                alternate_countries: "Argentina",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 3,
          pageCount: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(
      <DatasetTableStateProbe
        dataset={createDataset({
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
        })}
        regionFilter={{
          enabled: true,
          isSupported: true,
          hasConfiguredRegions: true,
          enabledCountryNames: ["Jordan", "Egypt"],
        }}
        countryFilter={{
          enabled: true,
          isSupported: true,
          selectedCountryNames: ["Jordan"],
          includeAlternateCountries: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("record-count").textContent).toBe("1");
    });

    expect(screen.getByTestId("available-countries").textContent).toBe(
      "Egypt,Jordan",
    );
    expect(screen.getByTestId("dataset-country-names").textContent).toBe(
      "Brazil,Egypt,Jordan",
    );
  });

  it("includes alternate countries in the visible option list when enabled", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/datasets/dataset-1/rows?page=1&pageSize=1000") {
        return buildJsonResponse({
          sourceDatasetId: "dataset-1",
          rows: [
            {
              id: "row-1",
              rowIndex: 0,
              data: {
                geo_country_name: "Jordan",
                alternate_countries: "Turkey",
              },
            },
            {
              id: "row-2",
              rowIndex: 1,
              data: {
                geo_country_name: "Egypt",
                alternate_countries: "Jordan; Libya",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 2,
          pageCount: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(
      <DatasetTableStateProbe
        dataset={createDataset({
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
        })}
        countryFilter={{
          enabled: false,
          isSupported: true,
          selectedCountryNames: [],
          includeAlternateCountries: true,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("available-countries").textContent).toBe(
      "Egypt,Jordan,Libya,Turkey",
    );
  });
});
