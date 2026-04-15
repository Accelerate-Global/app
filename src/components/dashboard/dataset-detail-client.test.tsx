// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary } from "@/lib/api-types";

import { DatasetDetailClient } from "./dataset-detail-client";

const datasetTableSpy = vi.fn();
const viewSwitchGridSpy = vi.fn();

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
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies Omit<DatasetSummary, "columns">;

describe("DatasetDetailClient", () => {
  beforeEach(() => {
    datasetTableSpy.mockReset();
    viewSwitchGridSpy.mockReset();
  });

  it("passes supported UUPG filter state into the card and table", () => {
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
        fieldDefinitionDescriptionsByColumnKey={{
          engage_global_engagement_anywhere: "UUPG definition",
        }}
      />,
    );

    const viewSwitchGridProps = viewSwitchGridSpy.mock.calls[0]?.[0] as {
      uupgCard: { enabled: boolean; supported: boolean };
    };
    const datasetTableProps = datasetTableSpy.mock.calls[0]?.[0] as {
      fieldDefinitionDescriptionsByColumnKey: Record<string, string>;
      uupgFilter: { enabled: boolean; isSupported: boolean };
    };

    expect(viewSwitchGridProps.uupgCard).toMatchObject({
      enabled: false,
      supported: true,
    });
    expect(datasetTableProps.uupgFilter).toEqual({
      enabled: false,
      isSupported: true,
    });
    expect(datasetTableProps.fieldDefinitionDescriptionsByColumnKey).toEqual({
      engage_global_engagement_anywhere: "UUPG definition",
    });
  });
});
