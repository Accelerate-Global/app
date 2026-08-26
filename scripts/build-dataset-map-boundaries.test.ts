import { describe, expect, it } from "vitest";

import { buildDatasetMapBoundaryCollection } from "./build-dataset-map-boundaries";

function collection(features: Array<{
  properties: Record<string, unknown>;
  geometry?: { type: "Point"; coordinates: [number, number] };
}>) {
  return {
    type: "FeatureCollection" as const,
    features: features.map((feature) => ({
      type: "Feature" as const,
      properties: feature.properties,
      geometry: feature.geometry ?? {
        type: "Point" as const,
        coordinates: [0, 0] as [number, number],
      },
    })),
  };
}

const catalogEntries = [
  {
    displayName: "Alpha",
    officialIsoAlpha3: "AAA",
    classification: "iso-official",
  },
  {
    displayName: "Beta",
    officialIsoAlpha3: "BBB",
    classification: "iso-official",
  },
] as const;

describe("buildDatasetMapBoundaryCollection", () => {
  it("preserves polygons and adds one point for an omitted official ISO3", () => {
    const result = buildDatasetMapBoundaryCollection({
      countries110m: collection([
        { properties: { ISO_A3: "AAA", ADMIN: "Alpha" } },
      ]),
      mapUnits50m: collection([
        {
          properties: {
            ISO_A3: "BBB",
            LABEL_X: 12,
            LABEL_Y: 34,
          },
        },
      ]),
      mapUnits10m: collection([]),
      catalogEntries,
    });

    expect(result).toMatchObject({
      officialIso3Count: 2,
      polygonCount: 1,
      pointCount: 1,
    });
    expect(result.collection.features[1]).toEqual({
      type: "Feature",
      properties: { iso3: "BBB", name: "Beta" },
      geometry: { type: "Point", coordinates: [12, 34] },
    });
  });

  it("fails closed when a pinned point coordinate is missing", () => {
    expect(() =>
      buildDatasetMapBoundaryCollection({
        countries110m: collection([
          { properties: { ISO_A3: "AAA", ADMIN: "Alpha" } },
        ]),
        mapUnits50m: collection([]),
        mapUnits10m: collection([]),
        catalogEntries,
      }),
    ).toThrow("No pinned Natural Earth point representation for BBB.");
  });
});
