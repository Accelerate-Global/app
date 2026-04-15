"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function TableSmokeFixture() {
  return (
    <Table>
      <TableCaption>Shared UI smoke data.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Column</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Status</TableCell>
          <TableCell>Ready</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Coverage</TableCell>
          <TableCell>Strict</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export default defineUiSmokeFixture({
  id: "table",
  title: "Table",
  description: "Tabular layout building blocks.",
  Component: TableSmokeFixture,
});
