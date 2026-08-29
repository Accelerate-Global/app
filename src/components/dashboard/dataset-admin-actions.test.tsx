// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatasetAdminActions } from "./dataset-admin-actions";

const sourceColumns = [
  { key: "pg_peopleid3", label: "PG_PeopleID3", sourceIndex: 0 },
];

describe("DatasetAdminActions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("centralizes dataset editing and partner exports in one smoke-covered menu", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ profiles: [], runs: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DatasetAdminActions
        datasetId="dataset-derived"
        partnerExportDatasetId="dataset-source"
        sourceColumns={sourceColumns}
      />,
    );

    expect(screen.queryByRole("button", { name: "Partner exports" })).toBeNull();

    const menuTrigger = screen.getByRole("button", { name: "Dataset actions" });
    expect(menuTrigger.getAttribute("data-smoke-trigger")).toBe(
      "dataset-actions-menu",
    );
    fireEvent.click(menuTrigger);

    const menu = await waitFor(() =>
      document.querySelector(
        '[data-smoke-surface="dataset-actions-menu"][data-smoke-ready="dataset-actions-menu"]',
      ),
    );
    expect(menu).toBeTruthy();

    const editItem = screen.getByRole("menuitem", { name: "Edit dataset" });
    expect(editItem.getAttribute("href")).toBe(
      "/dashboard/datasets/dataset-derived/edit",
    );

    const partnerExportsItem = screen.getByRole("menuitem", {
      name: "Partner exports",
    });
    expect(partnerExportsItem.getAttribute("data-smoke-trigger")).toBe(
      "partner-exports-sheet",
    );
    fireEvent.click(partnerExportsItem);

    expect(
      await screen.findByRole("heading", { name: "Partner exports" }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/datasets/dataset-source/partner-exports",
      { cache: "no-store" },
    );
  });
});
