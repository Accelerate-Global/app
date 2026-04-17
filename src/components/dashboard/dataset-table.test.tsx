// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRowsResponse, DatasetSummary } from "@/lib/api-types";

vi.mock("@/components/reui/data-grid/data-grid-table-virtual", async () => {
  const actual =
    await vi.importActual<
      typeof import("@/components/reui/data-grid/data-grid-table-virtual")
    >("@/components/reui/data-grid/data-grid-table-virtual");
  const disabledVirtualizerOptions = {
    enabled: false,
    scrollToFn: () => undefined,
  } as unknown as NonNullable<
    ComponentProps<typeof actual.DataGridTableVirtual>["virtualizerOptions"]
  >;

  return {
    ...actual,
    DataGridTableVirtual: (
      props: ComponentProps<typeof actual.DataGridTableVirtual>,
    ) => (
      <actual.DataGridTableVirtual
        {...props}
        virtualizerOptions={disabledVirtualizerOptions}
      />
    ),
  };
});

import { DatasetTable } from "./dataset-table";

const fetchMock = vi.fn();

function createDataset(): DatasetSummary {
  const now = new Date("2026-04-16T17:15:54.000Z").toISOString();

  return {
    id: "dataset-1",
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    status: "ready",
    rowCount: 3,
    sizeBytes: 4096,
    columns: [
      {
        key: "pg_rop3",
        label: "People Group: 6dig Code ROP3 (PGIC)",
        sourceIndex: 0,
      },
      {
        key: "geo_country_name",
        label: "Country",
        sourceIndex: 1,
      },
    ],
    hiddenColumnKeys: [],
    tags: [],
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createRowsResponse(): DatasetRowsResponse {
  return {
    rows: [
      {
        id: "row-1",
        rowIndex: 0,
        data: {
          pg_rop3: "100011.0",
          geo_country_name: "Egypt",
        },
      },
      {
        id: "row-2",
        rowIndex: 1,
        data: {
          pg_rop3: "100018.0",
          geo_country_name: "Turkey",
        },
      },
      {
        id: "row-3",
        rowIndex: 2,
        data: {
          pg_rop3: "100021.0",
          geo_country_name: "Egypt",
        },
      },
    ],
    page: 1,
    pageSize: 3,
    totalRows: 3,
    pageCount: 1,
  };
}

describe("DatasetTable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("keeps row numbers sparse after filtering and removes the visible hash header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(createRowsResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DatasetTable
        dataset={createDataset()}
        regionFilter={{
          enabled: true,
          isSupported: true,
          hasConfiguredRegions: true,
          enabledCountryNames: ["Egypt"],
        }}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Row number" })).toBeTruthy();

    const firstVisiblePeopleGroup = await screen.findByText("100011.0");
    const secondVisiblePeopleGroup = await screen.findByText("100021.0");

    await waitFor(() => {
      expect(screen.queryByText("100018.0")).toBeNull();
    });

    const firstVisibleRow = firstVisiblePeopleGroup.closest("tr");
    const secondVisibleRow = secondVisiblePeopleGroup.closest("tr");

    expect(firstVisibleRow).toBeTruthy();
    expect(secondVisibleRow).toBeTruthy();
    expect(within(firstVisibleRow as HTMLTableRowElement).getByText("1")).toBeTruthy();
    expect(within(secondVisibleRow as HTMLTableRowElement).getByText("3")).toBeTruthy();
  });

  it("orders visible fields alphabetically by their display label by default", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(createRowsResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DatasetTable
        dataset={{
          ...createDataset(),
          columns: [
            {
              key: "pg_rop3",
              label: "People Group: 6dig Code ROP3 (PGIC)",
              sourceIndex: 0,
            },
            {
              key: "geo_country_name",
              label: "Country",
              sourceIndex: 1,
            },
            {
              key: "alt_countries",
              label: "alt_countries",
              sourceIndex: 2,
            },
          ],
        }}
        fieldDefinitionPresentationByColumnKey={{
          pg_rop3: {
            definition: "",
            displayLabel: "ROP3",
            effectiveLabel: "ROP3",
            linkedSources: [],
          },
          geo_country_name: {
            definition: "",
            displayLabel: "Country",
            effectiveLabel: "Country",
            linkedSources: [],
          },
          alt_countries: {
            definition: "",
            displayLabel: "Alternate Countries",
            effectiveLabel: "Alternate Countries",
            linkedSources: [],
          },
        }}
      />,
    );

    await screen.findByText("100011.0");

    expect(
      screen.getAllByRole("columnheader").map((columnHeader) =>
        columnHeader.textContent?.trim(),
      ),
    ).toEqual([
      "Row number",
      "Alternate Countries",
      "Country",
      "ROP3",
    ]);
  });
});
