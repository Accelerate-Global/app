// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatasetRowsResponse } from "@/lib/api-types";

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

type DatasetRow = DatasetRowsResponse["rows"][number];

function createRows(): DatasetRow[] {
  return [
    {
      id: "row-1",
      rowIndex: 0,
      data: {
        country: "Egypt",
      },
    },
  ];
}

function DatasetTableHarness({
  rows,
  datasetError = null,
  error = null,
}: {
  rows: DatasetRow[];
  datasetError?: string | null;
  error?: string | null;
}) {
  const columns: ColumnDef<DatasetRow>[] = [
    {
      id: "country",
      accessorFn: (row) => row.data.country ?? "",
      header: () => <span>Country</span>,
      cell: ({ row }) => <span>{row.original.data.country}</span>,
      meta: {
        headerTitle: "Country",
      },
    },
  ];
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DatasetTable
      table={table}
      recordCount={rows.length}
      isLoading={false}
      datasetError={datasetError}
      error={error}
    />
  );
}

describe("DatasetTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders dataset and table errors above the data grid", () => {
    render(
      <DatasetTableHarness
        rows={createRows()}
        datasetError="The dataset failed to process."
        error="Rows could not be loaded."
      />,
    );

    expect(screen.getByText("Dataset error")).toBeTruthy();
    expect(screen.getByText("The dataset failed to process.")).toBeTruthy();
    expect(screen.getByText("Table error")).toBeTruthy();
    expect(screen.getByText("Rows could not be loaded.")).toBeTruthy();
  });

  it("shows the empty message when there are no visible rows", () => {
    render(<DatasetTableHarness rows={[]} />);

    expect(screen.getByText("No people groups found.")).toBeTruthy();
  });
});
