// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DatasetRecordProfileSheet } from "./dataset-record-profile-sheet";

afterEach(cleanup);

describe("DatasetRecordProfileSheet", () => {
  it("shows visible formatted fields as read-only text", () => {
    const unsafeName = '<img src=x onerror="alert(1)">';

    render(
      <DatasetRecordProfileSheet
        open
        row={{
          id: "row-1",
          rowIndex: 4,
          data: {
            pg_name_main: unsafeName,
            pg_population: "1234000",
            hidden_value: "not visible",
          },
        }}
        visibleColumns={[
          { key: "pg_name_main", label: "People Group Name", sourceIndex: 0 },
          { key: "pg_population", label: "Population", sourceIndex: 1 },
        ]}
        fieldDefinitionPresentationByColumnKey={{
          pg_name_main: {
            displayLabel: "People Group Name",
            effectiveLabel: "People Group",
            definition: "",
            linkedSources: [],
          },
        }}
        onOpenChange={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: unsafeName })).toBeTruthy();
    expect(screen.getByText("Read-only dataset profile · source row 5")).toBeTruthy();
    expect(screen.getByText("People Group")).toBeTruthy();
    expect(screen.getByText("1,234,000")).toBeTruthy();
    expect(screen.queryByText("not visible")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(
      document.querySelector(
        '[data-smoke-surface="dataset-record-profile-sheet"][data-smoke-ready="dataset-record-profile-sheet"]',
      ),
    ).toBeTruthy();
  });
});
