// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "./dashboard-client";

const pushMock = vi.fn();
const fetchMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function createDataset() {
  return {
    id: "dataset-1",
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columns: [
      {
        key: "people_group_id",
        label: "People Group ID",
        sourceIndex: 0,
      },
      {
        key: "country",
        label: "Country",
        sourceIndex: 1,
      },
    ],
    hiddenColumnKeys: [],
    tags: [
      {
        id: "tag-1",
        label: "Priority",
        color: "#262531",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

function createSavedTable() {
  return {
    id: "saved-table-1",
    datasetId: "dataset-1",
    datasetFileName: "Global.csv",
    name: "North Africa focus",
    details: "",
    filters: {
      region: {
        enabled: true,
        selectedRegionIds: ["region-1"],
        selectedRegionNames: ["North Africa"],
        enabledCountryNames: ["Egypt"],
      },
      watchlist: {
        enabled: false,
        threshold: 2,
        frontierGroupValue: true,
      },
      uupg: {
        enabled: false,
      },
      sorting: [],
    },
    savedRowCount: 28,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
  };
}

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
    confirmMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("opens and closes the dataset edit sheet while keeping the existing footer actions", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    expect(within(dialog).getByRole("button", { name: "Replace dataset" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: "Close" }).length).toBe(2);

    const closeButtons = within(dialog).getAllByRole("button", { name: "Close" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    });
  });

  it("routes to dataset replacement from the edit sheet", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Replace dataset" }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard/upload?replace=dataset-1");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    });
  });

  it("deletes datasets for admins from the edit sheet", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ dataset: createDataset() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete dataset" }));

    expect(confirmMock).toHaveBeenCalledWith('Delete the dataset "Global.csv"?');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/datasets/dataset-1", {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    });

    expect(screen.queryByText("Global.csv")).toBeNull();
    expect(screen.getByText("No datasets have been added yet.")).toBeTruthy();
  });

  it("shows dataset delete failures inline in the edit sheet", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "The dataset is locked." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete dataset" }));

    expect(confirmMock).toHaveBeenCalledWith('Delete the dataset "Global.csv"?');

    expect(await within(dialog).findByText("The dataset is locked.")).toBeTruthy();
    expect(screen.getAllByText("Global.csv")).toHaveLength(2);
  });

  it("opens the saved table details sheet and persists saved table edits", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          savedTable: {
            ...createSavedTable(),
            name: "North Africa saved",
            details: "Saved from dataset detail page.",
            updatedAt: new Date("2026-04-16T02:00:00.000Z").toISOString(),
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[createSavedTable()]}
        canManageDatasets={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Saved table details",
    });

    fireEvent.change(
      within(dialog).getByLabelText("Saved table name"),
      {
        target: { value: "North Africa saved" },
      },
    );
    fireEvent.change(
      within(dialog).getByLabelText("Details"),
      {
        target: { value: "Saved from dataset detail page." },
      },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/saved-tables/saved-table-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "North Africa saved",
          details: "Saved from dataset detail page.",
        }),
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Saved table details" }),
      ).toBeNull();
    });

    expect(screen.getByText("North Africa saved")).toBeTruthy();
    expect(screen.getByText("Saved from dataset detail page.")).toBeTruthy();
  });
});
