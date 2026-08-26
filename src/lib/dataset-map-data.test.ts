import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatasetRowsResponse } from "@/lib/api-types";
import isoCountryCatalog from "@/data/iso-country-codes.generated.json";
import {
  DATASET_MAP_METRIC_LABEL,
  aggregateDatasetMapRows,
  isDatasetMapBoundaryCollection,
  searchDatasetMapEntries,
  type DatasetMapBoundaryCollection,
} from "@/lib/dataset-map-data";

type DatasetRow = DatasetRowsResponse["rows"][number];

function createBoundaryCollection(
  entries: Array<{ iso3: string; name: string }>,
): DatasetMapBoundaryCollection {
  return {
    type: "FeatureCollection",
    features: entries.map((entry, index) => ({
      type: "Feature",
      properties: entry,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [index, 0],
            [index + 0.5, 0],
            [index + 0.5, 0.5],
            [index, 0],
          ],
        ],
      },
    })),
  };
}

function createRow(
  id: string,
  data: Record<string, string>,
  rowIndex = 0,
): DatasetRow {
  return { id, rowIndex, data };
}

const standardBoundaries = createBoundaryCollection([
  { iso3: "BRA", name: "Brazil" },
  { iso3: "IND", name: "India" },
  { iso3: "TZA", name: "United Republic of Tanzania" },
  { iso3: "USA", name: "United States of America" },
]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("aggregateDatasetMapRows", () => {
  it("prefers a valid canonical ISO3 value over a conflicting country name", () => {
    const aggregation = aggregateDatasetMapRows(
      [
        createRow("row-1", {
          Geo_ISO3: "ind",
          Geo_Country_Name: "Brazil",
          PG_Name_Main: "Alpha People",
        }),
      ],
      standardBoundaries,
    );

    expect(aggregation.countries).toEqual([
      expect.objectContaining({
        iso3: "IND",
        matchingRecordCount: 1,
        peopleGroups: [{ rowId: "row-1", name: "Alpha People" }],
      }),
    ]);
  });

  it("uses reviewed AX country-name fallbacks only when ISO3 is absent", () => {
    const aggregation = aggregateDatasetMapRows(
      [
        createRow("row-1", {
          Geo_Country_Name: "Tanzania, the United Republic of",
        }),
      ],
      standardBoundaries,
    );

    expect(aggregation.countries[0]).toEqual(
      expect.objectContaining({
        iso3: "TZA",
        name: "United Republic of Tanzania",
      }),
    );
  });

  it("keeps unknown ISO3 values unmapped instead of falling back to a name", () => {
    const aggregation = aggregateDatasetMapRows(
      [
        createRow("row-1", {
          Geo_ISO3: "XXX",
          Geo_Country_Name: "Brazil",
        }),
      ],
      standardBoundaries,
    );

    expect(aggregation.mappedRecordCount).toBe(0);
    expect(aggregation.unmappedReasonCounts["unknown-iso3"]).toBe(1);
  });

  it("separates missing, ambiguous, and unsupported geography", () => {
    const ambiguousBoundaries = createBoundaryCollection([
      { iso3: "AAA", name: "Shared Name" },
      { iso3: "BBB", name: "Shared Name" },
    ]);
    const aggregation = aggregateDatasetMapRows(
      [
        createRow("missing", {}),
        createRow("ambiguous", { Geo_Country_Name: "Shared Name" }),
        createRow("unsupported-name", { Geo_Country_Name: "Atlantis" }),
        createRow("unsupported-iso", { Geo_ISO3: "USA" }),
      ],
      ambiguousBoundaries,
    );

    expect(aggregation.unmappedRecordCount).toBe(4);
    expect(aggregation.unmappedReasonCounts).toEqual({
      "missing-geography": 1,
      "unknown-iso3": 0,
      "ambiguous-country": 1,
      "unsupported-boundary": 2,
    });
  });

  it("counts multiple rows per country, builds bounded local search, and preserves inputs", () => {
    const rows = [
      createRow(
        "row-1",
        {
          Geo_Country_Name: "Brazil",
          PG_Name_Main: "Ribeirinho",
        },
        0,
      ),
      createRow(
        "row-2",
        {
          Geo_Country_Name: "Brazil",
          people_name: "River People",
        },
        1,
      ),
    ];
    const originalRows = structuredClone(rows);
    const aggregation = aggregateDatasetMapRows(rows, standardBoundaries);

    expect(aggregation.countryByIso3.get("BRA")).toEqual(
      expect.objectContaining({ matchingRecordCount: 2 }),
    );
    expect(searchDatasetMapEntries(aggregation, "Brazil", 1)).toHaveLength(1);
    expect(searchDatasetMapEntries(aggregation, "river people")).toEqual([
      expect.objectContaining({
        type: "people-group",
        label: "River People",
        countryIso3: "BRA",
      }),
    ]);
    expect(rows).toEqual(originalRows);
  });

  it("retains one selectable record summary for every mapped row", () => {
    const aggregation = aggregateDatasetMapRows(
      [
        createRow(
          "named",
          { Geo_Country_Name: "India", PG_Name_Main: "Rana Tharu" },
          4,
        ),
        createRow("unnamed", { Geo_Country_Name: "India" }, 8),
      ],
      standardBoundaries,
    );

    expect(aggregation.countryByIso3.get("IND")?.records).toEqual([
      { rowId: "named", name: "Rana Tharu", sourceRowNumber: 5 },
      { rowId: "unnamed", name: "Record 9", sourceRowNumber: 9 },
    ]);
    expect(aggregation.countryByIso3.get("IND")?.matchingRecordCount).toBe(2);
  });

  it("is provider-free pure logic and names the measure matching records", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const aggregation = aggregateDatasetMapRows(
      [createRow("row-1", { Geo_Country_Name: "India" })],
      standardBoundaries,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(DATASET_MAP_METRIC_LABEL).toBe("matching records");
    expect(aggregation.metricLabel).toBe("matching records");
  });
});

describe("isDatasetMapBoundaryCollection", () => {
  it("accepts the minimal same-origin boundary shape and rejects malformed data", () => {
    expect(isDatasetMapBoundaryCollection(standardBoundaries)).toBe(true);
    expect(
      isDatasetMapBoundaryCollection({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { name: "India" } }],
      }),
    ).toBe(false);
  });
});

describe("production ISO3 boundary coverage", () => {
  const productionBoundaries = JSON.parse(
    readFileSync(
      new URL(
        "../../public/map-data/natural-earth-countries-110m.geojson",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as DatasetMapBoundaryCollection;
  const officialIso3Codes = [
    ...new Set(
      isoCountryCatalog.entries.flatMap((entry) =>
        entry.officialIsoAlpha3 ? [entry.officialIsoAlpha3] : [],
      ),
    ),
  ].sort();

  it("contains every official AX ISO3 exactly once with point fallbacks where needed", () => {
    const featureCodes = productionBoundaries.features.map(
      (feature) => feature.properties.iso3,
    );
    const featureCodeSet = new Set(featureCodes);

    expect(isDatasetMapBoundaryCollection(productionBoundaries)).toBe(true);
    expect(featureCodeSet.size).toBe(featureCodes.length);
    expect(officialIso3Codes).toHaveLength(249);
    expect(
      officialIso3Codes.filter((iso3) => !featureCodeSet.has(iso3)),
    ).toEqual([]);
    expect(
      productionBoundaries.features.filter(
        (feature) => feature.geometry.type === "Point",
      ),
    ).toHaveLength(75);
  });

  it("maps every official ISO3 even when its country name conflicts", () => {
    const aggregation = aggregateDatasetMapRows(
      officialIso3Codes.map((iso3, index) =>
        createRow(
          `official-${iso3}`,
          {
            Geo_ISO3: iso3,
            Geo_Country_Name: "Deliberately conflicting country name",
          },
          index,
        ),
      ),
      productionBoundaries,
    );

    expect(aggregation.mappedRecordCount).toBe(249);
    expect(aggregation.unmappedRecordCount).toBe(0);
    expect(
      aggregation.countries.map((country) => country.iso3).sort(),
    ).toEqual(officialIso3Codes);
  });
});
