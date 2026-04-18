// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavedTablesGrid } from "./saved-tables-grid";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

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
    country: {
      enabled: false,
      selectedCountryNames: [],
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
  it("updates the section copy and keeps centered headers aligned with row actions", () => {
    pushMock.mockReset();
    const onOpenDetails = vi.fn();

    const { container } = render(
      <SavedTablesGrid savedTables={[savedTable]} onOpenDetails={onOpenDetails} />,
    );

    const scroller = container.querySelector(".overflow-x-auto");
    const header = container.querySelector("[style]");
    const row = container.querySelector(
      '[data-smoke-saved-table-row="saved-table-1"]',
    ) as HTMLElement | null;

    expect(screen.queryByText("No details added yet.")).toBeNull();
    expect(scroller?.className).toContain("overflow-x-auto");
    expect(header?.getAttribute("style")).toContain("10.5rem");
    expect(screen.getByRole("heading", { name: "Saved Datasets" })).toBeTruthy();
    expect(
      screen.getByText("Personal filtered tables you have saved."),
    ).toBeTruthy();
    expect(screen.getByText("Source dataset").className).toContain("justify-center");
    expect(screen.getByText("People Groups").className).toContain("justify-center");
    expect(screen.getByText("All People Groups").className).toContain("text-center");

    expect(row).toBeTruthy();

    fireEvent.click(row!);

    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/datasets/dataset-1?savedTableId=saved-table-1&source=saved_table",
    );

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(onOpenDetails).toHaveBeenCalledWith(savedTable.id);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: `Download ${savedTable.name}` })
        .getAttribute("href"),
    ).toBe(`/api/saved-tables/${savedTable.id}/download`);
  });
});
