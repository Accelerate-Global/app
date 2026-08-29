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
  DataGridContainer: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div data-testid="data-grid-container" className={className}>
      {children}
    </div>
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
  onRowClick,
}: {
  rows: DatasetRow[];
  datasetError?: string | null;
  error?: string | null;
  onRowClick?: (row: DatasetRow) => void;
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
      onRowClick={onRowClick}
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
      base: "bg-card/95",
      headerSticky: "sticky top-0 z-10 bg-card/95 backdrop-blur-xs",
      headerRow: "bg-muted/30 [&>th[data-pinned]]:bg-card/95",
      body: "bg-card/95",
      bodyRow:
        "bg-card/95 [&>td]:h-10 [&>td]:py-0 [&>td[data-pinned]]:bg-card/95 [&:hover>td[data-pinned]]:bg-muted/40",
    });
    expect(screen.getByTestId("data-grid-container").className).toContain(
      "bg-card/95",
    );
    const scrollArea = screen.getByTestId("data-grid-scroll-area");
    expect(scrollArea.className).toContain("h-[560px]");
    expect(scrollArea.className).toContain("xl:h-[760px]");
    expect(scrollArea.className).toContain("bg-card/95");
  });

  it("passes the record-profile row action into the shared data grid", () => {
    const onRowClick = vi.fn();
    const rows = createRows();

    render(<DatasetTableHarness rows={rows} onRowClick={onRowClick} />);

    const dataGridProps = dataGridSpy.mock.lastCall?.[0] as {
      onRowClick?: (row: DatasetRow) => void;
    };
    dataGridProps.onRowClick?.(rows[0]!);

    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
