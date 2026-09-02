// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetSummary, SavedDatasetFilterState } from "@/lib/api-types";

import { DatasetTableActionBar } from "./dataset-table-action-bar";

const fetchMock = vi.fn();
const dataset = {
  id: "dataset-1",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  isWorkspaceVisible: true,
  status: "ready",
  rowCount: 12507,
  sizeBytes: 512,
  columns: [],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

const filters: SavedDatasetFilterState = {
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
};

describe("DatasetTableActionBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the filtered count with a matching People Groups label", () => {
    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    expect(screen.getByText("Current filtered table")).toBeTruthy();
    expect(screen.getByText("12,507")).toBeTruthy();
    expect(screen.getByText("People Groups")).toBeTruthy();
    expect(screen.queryByText("people groups in the current list")).toBeNull();
    const actions = document.querySelector(
      "[data-smoke-filtered-table-actions]",
    );
    expect(actions?.className).toContain("grid-cols-1");
    expect(actions?.className).toContain("sm:grid-cols-2");
    expect(screen.getByRole("button", { name: "Download" }).className).toContain(
      "w-full",
    );
    expect(
      screen.getByRole("button", { name: "Save to dashboard" }).className,
    ).toContain("w-full");
  });

  it("renders a mobile filters trigger when an opener is supplied", () => {
    const onOpenFilters = vi.fn();

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        onOpenFilters={onOpenFilters}
      />,
    );

    const filterButton = screen.getByRole("button", { name: "Filters" });

    expect(filterButton.getAttribute("data-smoke-trigger")).toBe(
      "dataset-filters-sheet",
    );

    fireEvent.click(filterButton);

    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it("supports an embedded surface inside the combined filters card", () => {
    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        variant="embedded"
      />,
    );

    const summary = document.querySelector(
      "[data-smoke-filtered-table-summary]",
    );

    expect(summary?.className).toContain("px-4");
    expect(summary?.className).not.toContain("rounded-2xl");
    expect(summary?.className).not.toContain("bg-card");
  });

  it("renders an admin-only assign trigger in the action row", () => {
    const onOpenAssignDerivedView = vi.fn();

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        onOpenAssignDerivedView={onOpenAssignDerivedView}
      />,
    );

    const assignButton = screen.getByRole("button", {
      name: "Create dataset from current view",
    });

    expect(assignButton.getAttribute("data-smoke-trigger")).toBe(
      "dataset-assign-derived-view-sheet",
    );
    expect(assignButton.className).toContain("col-span-full");

    fireEvent.click(assignButton);

    expect(onOpenAssignDerivedView).toHaveBeenCalledTimes(1);
  });

  it("hides the save action when saving is not allowed while keeping download available", () => {
    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        canSaveFilteredTable={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Save to dashboard" }),
    ).toBeNull();
  });

  it("tracks saved table creation outcomes", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          savedTable: {
            id: "saved-table-1",
            name: "Saved table",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save to dashboard" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/saved-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId: dataset.id,
          savedRowCount: 12507,
          filters,
        }),
      });
    });
  });

  it("hands only filter state—not the displayed count—to Qwen session storage", async () => {
    const conversationId = "20000000-0000-4000-8000-000000000002";
    vi.stubGlobal("crypto", { randomUUID: () => conversationId });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "signed-view-token",
          conversationId,
          summary: {
            chips: [{ label: "All People Groups", detail: null }],
            quickQuestions: [],
            returnUrl: `/dashboard/datasets/${dataset.id}`,
            uupgRationale: null,
          },
          expiresAt: Date.now() + 60_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const navigate = vi.fn();
    render(
      <DatasetTableActionBar
        dataset={dataset}
        filters={filters}
        recordCount={12507}
        getSortedRows={() => []}
        visibleColumns={[]}
        isLoading={false}
        hasError={false}
        fieldDefinitionPresentationByColumnKey={{}}
        canAskQwenAboutView
        onNavigateToPrivateDataChat={navigate}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ask Qwen about this view" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request).toEqual({ datasetId: dataset.id, conversationId, filters });
    expect(JSON.stringify(request)).not.toContain("12507");
    await waitFor(() =>
      expect(
        JSON.parse(
          sessionStorage.getItem("private-data-chat:view-context:v1") ?? "null",
        ),
      ).toMatchObject({ token: "signed-view-token", conversationId }),
    );
    expect(navigate).toHaveBeenCalledOnce();
  });
});
