// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDatasetRowsCache } from "@/components/dashboard/dataset-row-cache";
import { DashboardClient } from "./dashboard-client";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

function createDataset() {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global.csv",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    isPublic: true,
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
    defaultFilters: null,
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

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearDatasetRowsCache();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/rows?all=true" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        return buildJsonResponse({
          sourceDatasetId: "dataset-1",
          rows: [
            {
              id: "row-1",
              rowIndex: 0,
              data: {
                people_group_id: "PG-1",
                country: "Egypt",
              },
            },
          ],
          page: 1,
          pageSize: 1000,
          totalRows: 1,
          pageCount: 1,
        });
      }

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders admin edit links and omits resource and empty saved-dataset sections", () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets
      />,
    );

    const editLink = screen.getByRole("link", { name: "Edit" });

    expect(editLink.getAttribute("href")).toBe("/dashboard/datasets/dataset-1/edit");
    expect(screen.queryByText("Reference Resources")).toBeNull();
    expect(screen.queryByRole("link", { name: "Browse reference resources" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Saved Datasets" })).toBeNull();
    expect(screen.queryByText("No saved tables yet.")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Edit dataset" })).toBeNull();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "dashboard_viewed",
      expect.objectContaining({
        source_surface: "dashboard_page",
        success: true,
        dataset_count: 1,
        saved_table_count: 0,
      }),
    );
  });

  it("starts a background preload for the primary dataset rows", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets={false}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/datasets/dataset-1/rows?all=true",
      );
    });

    await waitFor(() => {
      expect(trackAppEventMock).toHaveBeenCalledWith(
        "dataset_preload_started",
        expect.objectContaining({
          source_surface: "dashboard_page",
          success: true,
          dataset_id: "dataset-1",
          source_dataset_id: "dataset-1",
        }),
      );
    });

    await waitFor(() => {
      expect(trackAppEventMock).toHaveBeenCalledWith(
        "dataset_preload_completed",
        expect.objectContaining({
          source_surface: "dashboard_page",
          success: true,
          dataset_id: "dataset-1",
          source_dataset_id: "dataset-1",
          row_count: 1,
        }),
      );
    });
  });

  it("does not track preload failures for cancelled row requests", async () => {
    const abortError = new Error("The user aborted a request.");
    abortError.name = "AbortError";

    fetchMock.mockImplementation(async (input, init) => {
      if (
        input === "/api/datasets/dataset-1/rows?all=true" &&
        (init?.method === undefined || init.method === "GET")
      ) {
        throw abortError;
      }

      throw new Error(`Unexpected fetch: ${String(input)} ${init?.method ?? "GET"}`);
    });

    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[]}
        canManageDatasets={false}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/datasets/dataset-1/rows?all=true",
      );
    });

    await waitFor(() => {
      expect(trackAppEventMock).toHaveBeenCalledWith(
        "dataset_preload_started",
        expect.objectContaining({
          source_surface: "dashboard_page",
          success: true,
          dataset_id: "dataset-1",
          source_dataset_id: "dataset-1",
        }),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(trackAppEventMock).not.toHaveBeenCalledWith(
      "dataset_preload_failed",
      expect.anything(),
    );
  });

  it("opens the saved table details sheet and persists saved table edits", async () => {
    render(
      <DashboardClient
        initialDatasets={[createDataset()]}
        initialSavedTables={[createSavedTable()]}
        canManageDatasets={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Saved Datasets" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Saved table details",
    });

    fireEvent.change(within(dialog).getByLabelText("Saved table name"), {
      target: { value: "North Africa saved" },
    });
    fireEvent.change(within(dialog).getByLabelText("Details"), {
      target: { value: "Saved from dataset detail page." },
    });
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
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "saved_table_updated",
      expect.objectContaining({
        source_surface: "saved_table_detail_sheet",
        success: true,
        dataset_id: "dataset-1",
        saved_table_id: "saved-table-1",
        saved_row_count: 28,
        filter_sections_enabled: "region",
      }),
    );
  });
});
