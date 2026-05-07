// @vitest-environment jsdom
/* eslint-disable react-hooks/incompatible-library */

import { render, screen } from "@testing-library/react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

import { DataGrid } from "@/components/reui/data-grid/data-grid";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";

vi.mock("@/lib/render-trace", () => ({
  measureDatasetPerfTiming: <T,>(_: string, callback: () => T) => callback(),
  useDatasetPerfRenderTrace: () => undefined,
}));

type TestRow = {
  name: string;
};

function DataGridTableHarness() {
  const columns: ColumnDef<TestRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
  ];
  const table = useReactTable({
    data: [{ name: "Alpha" }],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid table={table} recordCount={1}>
      <DataGridTable />
    </DataGrid>
  );
}

describe("DataGridTable", () => {
  it("prevents header text selection while leaving body cells selectable", () => {
    render(<DataGridTableHarness />);

    expect(screen.getByRole("columnheader", { name: "Name" }).className).toContain(
      "select-none",
    );
    expect(screen.getByRole("cell", { name: "Alpha" }).className).not.toContain(
      "select-none",
    );
  });
});
