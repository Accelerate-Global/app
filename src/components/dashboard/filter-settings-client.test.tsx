// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FilterRegion } from "@/lib/api-types";

import { FilterSettingsClient } from "./filter-settings-client";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

function createRegion(overrides: Partial<FilterRegion> = {}): FilterRegion {
  return {
    id: "region-1",
    name: "south_asia",
    description: "South Asia description",
    sortOrder: 1,
    countries: ["India", "Nepal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("FilterSettingsClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("tracks region creation with ids and counts only", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        region: createRegion({
          id: "region-2",
          name: "north_africa",
          description: "",
          sortOrder: 2,
          countries: ["Algeria"],
        }),
      }),
    });

    render(
      <FilterSettingsClient
        initialRegions={[]}
        countryOptions={["Algeria", "India", "Nepal"]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Region name"), {
      target: { value: "North Africa" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Search countries")[0], {
      target: { value: "Algeria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));
    fireEvent.click(screen.getByRole("button", { name: "Create region" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/filter-settings/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "North Africa",
          description: "",
          sortOrder: 1,
          countries: ["Algeria"],
        }),
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "filter_region_created",
      expect.objectContaining({
        route: "filter_settings",
        source_surface: "filter_region_create_form",
        success: true,
        region_id: "region-2",
        country_count: 1,
        sort_order: 2,
      }),
    );
  });

  it("tracks region updates", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        region: createRegion({
          name: "south_asia_updated",
          sortOrder: 3,
        }),
      }),
    });

    render(
      <FilterSettingsClient
        initialRegions={[createRegion()]}
        countryOptions={["India", "Nepal"]}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Region name")[1], {
      target: { value: "South Asia Updated" },
    });
    fireEvent.change(screen.getAllByLabelText("Card order")[1], {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save region" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/filter-settings/regions/region-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "South Asia Updated",
          description: "South Asia description",
          sortOrder: 3,
          countries: ["India", "Nepal"],
        }),
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "filter_region_updated",
      expect.objectContaining({
        route: "filter_settings",
        source_surface: "filter_region_editor",
        success: true,
        region_id: "region-1",
        country_count: 2,
        sort_order: 3,
      }),
    );
  });

  it("tracks region deletions", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    render(
      <FilterSettingsClient
        initialRegions={[createRegion()]}
        countryOptions={["India", "Nepal"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete region" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/filter-settings/regions/region-1", {
        method: "DELETE",
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "filter_region_deleted",
      expect.objectContaining({
        route: "filter_settings",
        source_surface: "filter_region_editor",
        success: true,
        region_id: "region-1",
        country_count: 2,
        sort_order: 1,
      }),
    );
  });
});
