// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

describe("Table", () => {
  it("prevents header text selection while leaving body cells selectable", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Afghanistan</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("columnheader", { name: "Country" }).className).toContain(
      "select-none",
    );
    expect(screen.getByRole("cell", { name: "Afghanistan" }).className).not.toContain(
      "select-none",
    );
  });
});
