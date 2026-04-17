// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedTablesGrid } from "./saved-tables-grid";

const savedTable = {
  id: "saved-table-1",
  datasetId: "dataset-1",
  datasetFileName: "All People Groups",
  name: "All People Groups Saved view 1",
  details: "",
  filters: {
    region: {
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
      enabledCountryNames: [],
    },
    watchlist: {
      enabled: false,
      threshold: 0,
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: false,
    },
    uupg: {
      enabled: false,
    },
    sorting: [],
  },
  savedRowCount: 4086,
  createdAt: new Date("2026-04-17T16:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-04-17T16:00:00.000Z").toISOString(),
};

describe("SavedTablesGrid", () => {
  it("omits the empty details placeholder and keeps row actions available", () => {
    const onOpenDetails = vi.fn();

    const { container } = render(
      <SavedTablesGrid savedTables={[savedTable]} onOpenDetails={onOpenDetails} />,
    );

    const scroller = container.querySelector(".overflow-x-auto");
    const header = container.querySelector("[style]");

    expect(screen.queryByText("No details added yet.")).toBeNull();
    expect(scroller?.className).toContain("overflow-x-auto");
    expect(header?.getAttribute("style")).toContain("max-content");

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(onOpenDetails).toHaveBeenCalledWith(savedTable.id);
    expect(
      screen
        .getByRole("link", { name: `Download ${savedTable.name}` })
        .getAttribute("href"),
    ).toBe(`/api/saved-tables/${savedTable.id}/download`);
  });
});
