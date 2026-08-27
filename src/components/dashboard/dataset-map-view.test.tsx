// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatasetRowsResponse } from "@/lib/api-types";
import type { DatasetMapBoundaryCollection } from "@/lib/dataset-map-data";
import { DatasetMapView } from "./dataset-map-view";

const rendererState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("./dataset-country-map", async () => {
  const { useEffect } = await import("react");

  return {
    DATASET_MAP_COUNT_FILL_COLORS: [
      "var(--dataset-map-count-low)",
      "var(--dataset-map-count-medium)",
      "var(--dataset-map-count-high)",
      "var(--dataset-map-count-maximum)",
    ],
    DatasetCountryMap: (props: {
      countries: Array<{ iso3: string; name: string }>;
      onSelectCountry: (iso3: string) => void;
      onReady: () => void;
      onError: (message: string) => void;
    }) => {
      useEffect(() => {
        if (rendererState.shouldFail) {
          props.onError("Renderer failed.");
          return;
        }

        props.onReady();
      }, [props]);

      return (
        <div aria-label="Matching records by country">
          {props.countries.map((country) => (
            <button
              key={country.iso3}
              type="button"
              onClick={() => props.onSelectCountry(country.iso3)}
            >
              Select {country.name}
            </button>
          ))}
        </div>
      );
    },
  };
});

const boundaries: DatasetMapBoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { iso3: "BRA", name: "Brazil" },
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      },
    },
    {
      type: "Feature",
      properties: { iso3: "IND", name: "India" },
      geometry: {
        type: "Polygon",
        coordinates: [[[2, 0], [3, 0], [3, 1], [2, 0]]],
      },
    },
  ],
};

const fetchMock = vi.fn();

function createRow(
  id: string,
  data: Record<string, string>,
  rowIndex = 0,
): DatasetRowsResponse["rows"][number] {
  return { id, rowIndex, data };
}

beforeEach(() => {
  rendererState.shouldFail = false;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(boundaries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DatasetMapView", () => {
  it("loads only the same-origin boundary and reports mapped and unmapped rows", async () => {
    render(
      <DatasetMapView
        rows={[
          createRow("india", {
            Geo_Country_Name: "India",
            PG_Name_Main: "Rana Tharu",
          }),
          createRow("brazil", {
            Geo_Country_Name: "Brazil",
            PG_Name_Main: "Ribeirinho",
          }),
          createRow("unknown", { Geo_ISO3: "XXX" }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("2", { selector: "strong" })).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/map-data/natural-earth-countries-110m.geojson",
    );
    expect(
      document.querySelector("[data-smoke-map-mapped-count]")?.textContent,
    ).toContain("2 mapped");
    expect(
      document.querySelector("[data-smoke-map-unmapped-count]")?.textContent,
    ).toContain("1 unmapped");
    await waitFor(() => {
      expect(
        document.querySelector('[data-smoke-ready="dataset-map"]'),
      ).toBeTruthy();
    });
    expect(screen.getByLabelText("Matching records legend")).toBeTruthy();
    expect(
      Array.from(
        document.querySelectorAll("[data-smoke-map-legend-swatch]"),
        (swatch) => swatch.getAttribute("style"),
      ),
    ).toEqual([
      "background-color: var(--dataset-map-count-low);",
      "background-color: var(--dataset-map-count-medium);",
      "background-color: var(--dataset-map-count-high);",
      "background-color: var(--dataset-map-count-maximum);",
    ]);
    expect(
      screen.queryByRole("link", { name: "Made with Natural Earth" }),
    ).toBeNull();
    expect(screen.queryByText(/Natural Earth/i)).toBeNull();
  });

  it("searches countries and people groups locally and opens textual summaries", async () => {
    render(
      <DatasetMapView
        rows={[
          createRow("india", {
            Geo_Country_Name: "India",
            PG_Name_Main: "Rana Tharu",
          }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    const search = await screen.findByLabelText("Search this result");
    fireEvent.change(search, { target: { value: "Rana" } });

    const result = screen.getByRole("button", { name: /Rana Tharu.*India/ });
    expect(result.tagName).toBe("BUTTON");
    fireEvent.click(result);

    const focusedMatch = screen.getByText("Focused match: Rana Tharu");
    expect(focusedMatch.className).toContain("bg-accent/60");
    expect(focusedMatch.className).not.toContain("teal");
    expect(
      screen.getByRole("list", { name: "Records in India" }).textContent,
    ).toContain("Rana Tharu");

    fireEvent.change(search, { target: { value: "India" } });
    fireEvent.click(screen.getByRole("button", { name: /India.*Country/ }));
    expect(screen.getByText("1 record")).toBeTruthy();
  });

  it("renders untrusted-looking dataset values as text rather than popup HTML", async () => {
    const unsafeName = '<img src=x onerror="alert(1)">';
    render(
      <DatasetMapView
        rows={[
          createRow("india", {
            Geo_Country_Name: "India",
            PG_Name_Main: unsafeName,
          }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    const search = await screen.findByLabelText("Search this result");
    fireEvent.change(search, { target: { value: "img" } });
    fireEvent.click(screen.getByRole("button", { name: /img src/ }));

    expect(screen.getByText(`Focused match: ${unsafeName}`)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows no-results and no-usable-geography states without disabling the shell", async () => {
    const { rerender } = render(
      <DatasetMapView rows={[]} isLoading={false} error={null} />,
    );

    expect(
      await screen.findByText(/No records match the current filters/),
    ).toBeTruthy();

    rerender(
      <DatasetMapView
        rows={[createRow("unknown", { Geo_ISO3: "XXX" })]}
        isLoading={false}
        error={null}
      />,
    );

    expect(await screen.findByText("No usable country geography")).toBeTruthy();
    expect(screen.getByText(/1 record could not be matched/)).toBeTruthy();
  });

  it("isolates renderer failures in a recoverable map error", async () => {
    rendererState.shouldFail = true;
    render(
      <DatasetMapView
        rows={[createRow("india", { Geo_Country_Name: "India" })]}
        isLoading={false}
        error={null}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The map could not be displayed.",
    );
    expect(screen.getByText(/Renderer failed/)).toBeTruthy();
  });

  it("selects country records and hands all or selected row ids to the table", async () => {
    const onViewRowsInTable = vi.fn();
    const onOpenRecord = vi.fn();

    render(
      <DatasetMapView
        rows={[
          createRow(
            "india-1",
            { Geo_Country_Name: "India", PG_Name_Main: "Rana Tharu" },
            3,
          ),
          createRow(
            "india-2",
            { Geo_Country_Name: "India", PG_Name_Main: "Sahisia" },
            8,
          ),
        ]}
        isLoading={false}
        error={null}
        onViewRowsInTable={onViewRowsInTable}
        onOpenRecord={onOpenRecord}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Select India" }));

    const selectedAction = screen.getByRole("button", {
      name: "View selected (0) in Table",
    });
    expect(selectedAction).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Rana Tharu" }));
    fireEvent.click(
      screen.getByRole("button", { name: "View selected (1) in Table" }),
    );
    expect(onViewRowsInTable).toHaveBeenLastCalledWith({
      label: "India · 1 selected",
      rowIds: ["india-1"],
    });

    fireEvent.click(screen.getByRole("button", { name: "View all in Table" }));
    expect(onViewRowsInTable).toHaveBeenLastCalledWith({
      label: "India",
      rowIds: ["india-1", "india-2"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Rana Tharu/ }));
    expect(onOpenRecord).toHaveBeenCalledWith("india-1");
  });

  it("bounds long country record lists and progressively reveals more", async () => {
    render(
      <DatasetMapView
        rows={Array.from({ length: 25 }, (_, index) =>
          createRow(
            `india-${index + 1}`,
            {
              Geo_Country_Name: "India",
              PG_Name_Main: `People ${String(index + 1).padStart(2, "0")}`,
            },
            index,
          ),
        )}
        isLoading={false}
        error={null}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Select India" }));
    const recordList = screen.getByRole("list", { name: "Records in India" });
    expect(recordList.querySelectorAll("li")).toHaveLength(24);

    fireEvent.click(screen.getByRole("button", { name: "Show more records" }));
    expect(recordList.querySelectorAll("li")).toHaveLength(25);
  });

  it("keeps map selection mounted while effective appearance changes", async () => {
    render(
      <DatasetMapView
        rows={[createRow("india", { Geo_Country_Name: "India" })]}
        isLoading={false}
        error={null}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Select India" }));
    expect(screen.getByText("Selected country")).toBeTruthy();

    document.documentElement.classList.add("dark");

    expect(screen.getByText("Selected country")).toBeTruthy();
    expect(document.querySelectorAll("[data-smoke-map-legend-swatch]")).toHaveLength(4);

    document.documentElement.classList.remove("dark");
  });
});
