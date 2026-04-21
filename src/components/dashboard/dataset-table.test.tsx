// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatasetRowsResponse } from "@/lib/api-types";

const dataGridSpy = vi.fn();
const virtualTableSpy = vi.fn();

vi.mock("@/components/reui/data-grid/data-grid", () => ({
  DataGrid: (props: ComponentProps<typeof import("@/components/reui/data-grid/data-grid")["DataGrid"]>) => {
    dataGridSpy(props);
    return <div data-testid="data-grid">{props.children}</div>;
  },
  DataGridContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="data-grid-container">{children}</div>
  ),
}));

vi.mock("@/components/reui/data-grid/data-grid-scroll-area", () => ({
  DataGridScrollArea: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div data-testid="data-grid-scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/reui/data-grid/data-grid-table-virtual", () => ({
  DataGridTableVirtual: (
    props: ComponentProps<
      typeof import("@/components/reui/data-grid/data-grid-table-virtual")["DataGridTableVirtual"]
    >,
  ) => {
    virtualTableSpy(props);
    return <div data-testid="data-grid-table-virtual" />;
  },
}));

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
    dataGridSpy.mockReset();
    virtualTableSpy.mockReset();
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

    const dataGridProps = dataGridSpy.mock.lastCall?.[0] as {
      emptyMessage?: string;
    };

    expect(dataGridProps.emptyMessage).toBe("No people groups found.");
  });

  it("uses a smaller overscan and stable grid layout props", () => {
    render(<DatasetTableHarness rows={createRows()} />);

    const dataGridProps = dataGridSpy.mock.lastCall?.[0] as {
      tableLayout: Record<string, unknown>;
      tableClassNames: Record<string, unknown>;
    };
    const virtualTableProps = virtualTableSpy.mock.lastCall?.[0] as {
      overscan?: number;
    };

    expect(virtualTableProps.overscan).toBe(10);
    expect(dataGridProps.tableLayout).toEqual({
      columnsPinnable: true,
      columnsResizable: true,
      headerSticky: true,
    });
    expect(dataGridProps.tableClassNames).toEqual({
      headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
      bodyRow: "[&>td]:h-10 [&>td]:py-0",
    });
  });
});
