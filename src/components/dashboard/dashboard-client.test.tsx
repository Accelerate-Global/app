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
      country: {
        enabled: false,
        selectedCountryNames: [],
      },
      watchlist: {
        enabled: false,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentThreshold: 0.05,
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

function createDatasetVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-version-1",
    datasetId: "dataset-1",
    isCurrent: true,
    fileName: "Global.csv",
    action: "upload" as const,
    actorOwnerId: "supabase-user",
    actorEmail: "admin@example.com",
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columnCount: 2,
    versionCreatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
    confirmMock.mockReturnValue(true);
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/versions" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({
          versions: [
            createDatasetVersion(),
            createDatasetVersion({
              id: "dataset-version-0",
              isCurrent: false,
              fileName: "Global-upload.csv",
              action: "replace",
              actorEmail: "editor@example.com",
              rowCount: 120,
              versionCreatedAt: new Date("2026-04-14T12:00:00.000Z").toISOString(),
              archivedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
            }),
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });
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
  }, 10000);

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

  it("loads upload history when the edit sheet opens", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });

    expect(await within(dialog).findByText("Upload history")).toBeTruthy();
    expect(await within(dialog).findByText("Global-upload.csv")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/datasets/dataset-1/versions");
  });

  it("reverts a historical dataset version from the edit sheet", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/versions" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({
          versions: [
            createDatasetVersion({
              action: "revert",
              versionCreatedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
            }),
            createDatasetVersion({
              id: "dataset-version-0",
              isCurrent: false,
              fileName: "Global-upload.csv",
              action: "replace",
              actorEmail: "editor@example.com",
              rowCount: 120,
              versionCreatedAt: new Date("2026-04-14T12:00:00.000Z").toISOString(),
              archivedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
            }),
          ],
        });
      }

      if (
        input === "/api/datasets/dataset-1/versions/dataset-version-0/revert" &&
        init?.method === "POST"
      ) {
        return buildJsonResponse({
          dataset: {
            ...createDataset(),
            updatedAt: new Date("2026-04-17T10:30:00.000Z").toISOString(),
          },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit dataset" });
    const historicalRow = await within(dialog).findByText("Global-upload.csv");
    fireEvent.click(
      within(historicalRow.closest("[data-smoke-dataset-version-row]") as HTMLElement).getByRole(
        "button",
        { name: "Revert" },
      ),
    );

    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining("Revert to Global-upload.csv"),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/datasets/dataset-1/versions/dataset-version-0/revert",
        { method: "POST" },
      );
    });

    await waitFor(() => {
      const datasetRow = document.querySelector(
        '[data-smoke-dataset-row="dataset-1"]',
      ) as HTMLElement | null;

      expect(datasetRow).toBeTruthy();
      expect(within(datasetRow!).getByText("Global.csv")).toBeTruthy();
      expect(within(datasetRow!).queryByText("Global-upload.csv")).toBeNull();
    });
  });

  it("deletes datasets for admins from the edit sheet", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/versions" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({ versions: [createDatasetVersion()] });
      }

      if (input === "/api/datasets/dataset-1" && init?.method === "DELETE") {
        return buildJsonResponse({ dataset: createDataset() });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

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
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/versions" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({ versions: [createDatasetVersion()] });
      }

      if (input === "/api/datasets/dataset-1" && init?.method === "DELETE") {
        return buildJsonResponse({ error: "The dataset is locked." }, 409);
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

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
    expect(screen.getAllByText("Global.csv").length).toBeGreaterThanOrEqual(2);
  });

  it("opens the saved table details sheet and persists saved table edits", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (input === "/api/saved-tables/saved-table-1" && init?.method === "PATCH") {
        return buildJsonResponse({
          savedTable: {
            ...createSavedTable(),
            name: "North Africa saved",
            details: "Saved from dataset detail page.",
            updatedAt: new Date("2026-04-16T02:00:00.000Z").toISOString(),
          },
        });
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

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
