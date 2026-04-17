// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary } from "@/lib/api-types";

import { DatasetDetailClient } from "./dataset-detail-client";

const actionBarSpy = vi.fn();
const datasetTableSpy = vi.fn();
const useDatasetTableStateMock = vi.fn();
const viewSwitchGridSpy = vi.fn();

vi.mock("@/components/dashboard/dataset-table-action-bar", () => ({
  DatasetTableActionBar: (props: unknown) => {
    actionBarSpy(props);
    return null;
  },
}));

vi.mock("@/components/dashboard/dataset-table", () => ({
  DatasetTable: (props: unknown) => {
    datasetTableSpy(props);
    return null;
  },
}));

vi.mock("@/components/dashboard/dataset-view-switch-grid", () => ({
  DatasetViewSwitchGrid: (props: unknown) => {
    viewSwitchGridSpy(props);
    return null;
  },
}));

vi.mock("@/components/dashboard/use-dataset-table-state", () => ({
  useDatasetTableState: (props: unknown) => useDatasetTableStateMock(props),
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

describe("DatasetDetailClient", () => {
  beforeEach(() => {
    actionBarSpy.mockReset();
    datasetTableSpy.mockReset();
    useDatasetTableStateMock.mockReset();
    viewSwitchGridSpy.mockReset();
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [],
      visibleColumns: [],
      sortedRows: [],
      recordCount: 2,
      isLoading: false,
      error: null,
    });
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
      uupgCard: { enabled: boolean; supported: boolean };
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

  it("passes supported watchlist filter state into the card, shared table state, and action bar", () => {
    useDatasetTableStateMock.mockReturnValue({
      table: {} as never,
      sorting: [{ id: "christianity_gsec", desc: false }],
      visibleColumns: [],
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
        }}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.calls[0]?.[0] as {
      watchlistCard: {
        enabled: boolean;
        supported: boolean;
        thresholdLabel: string;
        thresholdDefinition: string;
        threshold: number;
        minThreshold: number;
        maxThreshold: number;
        frontierGroupLabel: string;
        frontierGroupDefinition: string;
        frontierGroupValue: boolean;
      };
    };
    const datasetTableStateProps = useDatasetTableStateMock.mock.calls[0]?.[0] as {
      watchlistFilter: {
        enabled: boolean;
        isSupported: boolean;
        threshold: number;
        frontierGroupValue: boolean;
      };
    };
    const actionBarProps = actionBarSpy.mock.calls[0]?.[0] as {
      filters: {
        watchlist: {
          enabled: boolean;
          threshold: number;
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
      threshold: 2,
      minThreshold: 0,
      maxThreshold: 6,
      frontierGroupLabel: "Christianity: Frontier Group Y/N",
      frontierGroupDefinition: "Frontier group definition",
      frontierGroupValue: true,
    });
    expect(datasetTableStateProps.watchlistFilter).toEqual({
      enabled: false,
      isSupported: true,
      threshold: 2,
      frontierGroupValue: true,
    });
    expect(actionBarProps.filters.watchlist).toEqual({
      enabled: false,
      threshold: 2,
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
});
