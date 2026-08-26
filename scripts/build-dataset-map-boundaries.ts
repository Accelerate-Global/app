import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { Feature, FeatureCollection, Geometry, Point } from "geojson";

import isoCountryCatalog from "../src/data/iso-country-codes.generated.json";

const NATURAL_EARTH_RELEASE = "v5.1.2";
const SOURCE_RETRIEVED_DATE = "2026-08-26";
const SOURCE_URLS = {
  countries110m: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_RELEASE}/geojson/ne_110m_admin_0_countries.geojson`,
  mapUnits50m: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_RELEASE}/geojson/ne_50m_admin_0_map_units.geojson`,
  mapUnits10m: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_RELEASE}/geojson/ne_10m_admin_0_map_units.geojson`,
} as const;
const OUTPUT_PATH = new URL(
  "../public/map-data/natural-earth-countries-110m.geojson",
  import.meta.url,
);
const README_PATH = new URL("../public/map-data/README.md", import.meta.url);
const OFFICIAL_CODE_FIELDS = [
  "ISO_A3",
  "ADM0_ISO",
  "GU_A3",
  "SU_A3",
  "ADM0_A3",
  "BRK_A3",
] as const;

type SourceProperties = Record<string, unknown>;
type SourceCollection = FeatureCollection<Geometry, SourceProperties>;
type BoundaryProperties = { iso3: string; name: string };
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;
type CatalogEntry = Pick<
  (typeof isoCountryCatalog.entries)[number],
  "classification" | "displayName" | "officialIsoAlpha3"
>;

export type DatasetMapBoundaryBuildResult = {
  collection: BoundaryCollection;
  officialIso3Count: number;
  polygonCount: number;
  pointCount: number;
};

function normalizeIso3(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/u.test(code) && code !== "XXX" ? code : null;
}

function getPolygonIso3(properties: SourceProperties) {
  return normalizeIso3(properties.ISO_A3) ?? normalizeIso3(properties.ADM0_A3);
}

function getOfficialCodeCandidates(
  properties: SourceProperties,
  officialCodes: ReadonlySet<string>,
) {
  return OFFICIAL_CODE_FIELDS.flatMap((field) => {
    const code = normalizeIso3(properties[field]);
    return code && officialCodes.has(code) ? [code] : [];
  });
}

function getLabelCoordinates(properties: SourceProperties) {
  const longitude = Number(properties.LABEL_X);
  const latitude = Number(properties.LABEL_Y);

  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? ([longitude, latitude] as [number, number])
    : null;
}

function getOfficialCatalog(input: readonly CatalogEntry[]) {
  const officialEntries = input.filter((entry) => entry.officialIsoAlpha3);
  const officialCodes = new Set(
    officialEntries.map((entry) => entry.officialIsoAlpha3!),
  );
  const displayNameByIso3 = new Map<string, string>();

  for (const entry of officialEntries) {
    const iso3 = entry.officialIsoAlpha3!;
    const existing = displayNameByIso3.get(iso3);

    if (!existing || entry.classification === "iso-official") {
      displayNameByIso3.set(iso3, entry.displayName);
    }
  }

  return { officialCodes, displayNameByIso3 };
}

function findPointSource(input: {
  iso3: string;
  collections: readonly SourceCollection[];
  officialCodes: ReadonlySet<string>;
}) {
  for (const collection of input.collections) {
    const match = collection.features.find(
      (feature) =>
        getOfficialCodeCandidates(feature.properties, input.officialCodes).includes(
          input.iso3,
        ) && Boolean(getLabelCoordinates(feature.properties)),
    );

    if (match) {
      return match;
    }
  }

  return null;
}

export function buildDatasetMapBoundaryCollection(input: {
  countries110m: SourceCollection;
  mapUnits50m: SourceCollection;
  mapUnits10m: SourceCollection;
  catalogEntries?: readonly CatalogEntry[];
}): DatasetMapBoundaryBuildResult {
  const { officialCodes, displayNameByIso3 } = getOfficialCatalog(
    input.catalogEntries ?? isoCountryCatalog.entries,
  );
  const polygonFeatures = input.countries110m.features.map((feature) => {
    const iso3 = getPolygonIso3(feature.properties);
    const name = String(feature.properties.ADMIN ?? "").trim();

    if (!iso3 || !name) {
      throw new Error("Natural Earth 1:110m country feature lacks ISO3 or ADMIN.");
    }

    return {
      type: "Feature",
      properties: { iso3, name },
      geometry: feature.geometry,
    } satisfies Feature<Geometry, BoundaryProperties>;
  });
  const polygonCodes = new Set(
    polygonFeatures.map((feature) => feature.properties.iso3),
  );

  if (polygonCodes.size !== polygonFeatures.length) {
    throw new Error("Natural Earth 1:110m country ISO3 values are not unique.");
  }

  const pointFeatures = [...officialCodes]
    .filter((iso3) => !polygonCodes.has(iso3))
    .sort()
    .map((iso3) => {
      const source = findPointSource({
        iso3,
        collections: [input.mapUnits50m, input.mapUnits10m],
        officialCodes,
      });
      const coordinates = source
        ? getLabelCoordinates(source.properties)
        : null;
      const name = displayNameByIso3.get(iso3);

      if (!coordinates || !name) {
        throw new Error(`No pinned Natural Earth point representation for ${iso3}.`);
      }

      return {
        type: "Feature",
        properties: { iso3, name },
        geometry: { type: "Point", coordinates },
      } satisfies Feature<Point, BoundaryProperties>;
    });
  const features = [...polygonFeatures, ...pointFeatures];
  const outputCodes = features.map((feature) => feature.properties.iso3);
  const uniqueOutputCodes = new Set(outputCodes);

  if (uniqueOutputCodes.size !== outputCodes.length) {
    throw new Error("Generated map boundary ISO3 values are not unique.");
  }

  const missingOfficialCodes = [...officialCodes].filter(
    (iso3) => !uniqueOutputCodes.has(iso3),
  );
  if (missingOfficialCodes.length > 0) {
    throw new Error(
      `Generated map boundary is missing official ISO3 codes: ${missingOfficialCodes.join(", ")}.`,
    );
  }

  return {
    collection: { type: "FeatureCollection", features },
    officialIso3Count: officialCodes.size,
    polygonCount: polygonFeatures.length,
    pointCount: pointFeatures.length,
  };
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchSource(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Boundary source request failed: ${response.status} ${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const collection = JSON.parse(new TextDecoder().decode(bytes)) as SourceCollection;
  return { bytes, collection };
}

function buildReadme(input: {
  result: DatasetMapBoundaryBuildResult;
  output: Uint8Array;
  sources: Record<keyof typeof SOURCE_URLS, Uint8Array>;
}) {
  const gzipBytes = gzipSync(input.output).byteLength;

  return `# Dataset map boundary data

\`natural-earth-countries-110m.geojson\` is the provider-free ISO3 boundary layer for the dataset map.

- Source release: Natural Earth \`${NATURAL_EARTH_RELEASE}\`
- Retrieved: ${SOURCE_RETRIEVED_DATE}
- Polygon source: <${SOURCE_URLS.countries110m}>
- Point coordinate source: <${SOURCE_URLS.mapUnits50m}>
- Fallback point coordinate source: <${SOURCE_URLS.mapUnits10m}>
- Terms: Natural Earth vector and raster data is public domain
- Terms URL: <https://www.naturalearthdata.com/about/terms-of-use/>
- 1:110m source SHA-256: \`${sha256(input.sources.countries110m)}\`
- 1:50m source SHA-256: \`${sha256(input.sources.mapUnits50m)}\`
- 1:10m source SHA-256: \`${sha256(input.sources.mapUnits10m)}\`
- Output SHA-256: \`${sha256(input.output)}\`
- Output size: ${input.output.byteLength.toLocaleString("en-US")} bytes
- Gzip size from Node \`gzipSync\`: ${gzipBytes.toLocaleString("en-US")} bytes

## ISO3 coverage

- Official ISO3 codes in the AX catalog: ${input.result.officialIso3Count}
- 1:110m polygon features: ${input.result.polygonCount}
- Point fallbacks for omitted official codes: ${input.result.pointCount}
- Total output features: ${input.result.collection.features.length}
- Official ISO3 coverage: 100%

The builder preserves every 1:110m country geometry and retains only \`iso3\` and \`name\`. It then adds one GeoJSON Point for each official AX ISO3 omitted by the lightweight polygons, using pinned Natural Earth map-unit label coordinates. ISO3 values use \`ISO_A3\`, falling back to the relevant Natural Earth administrative code when needed.

The collection is compacted to one JSON line and loaded from the AX Online origin only after a user opens Map mode. Runtime tile, style, font, search, geocoding, and external boundary requests are prohibited.

Regenerate with \`pnpm run data:build:dataset-map-boundaries\`. Generation fails if official ISO3 coverage is incomplete or output codes are duplicated.

## Local MVP build footprint

The map UI and Leaflet remain lazy-loaded after the user selects Map mode. The bundled boundary asset adds only point coordinates for the official codes omitted by the 1:110m polygon source, preserving the free-tier-oriented payload.
`;
}

async function main() {
  const [countries110m, mapUnits50m, mapUnits10m] = await Promise.all([
    fetchSource(SOURCE_URLS.countries110m),
    fetchSource(SOURCE_URLS.mapUnits50m),
    fetchSource(SOURCE_URLS.mapUnits10m),
  ]);
  const result = buildDatasetMapBoundaryCollection({
    countries110m: countries110m.collection,
    mapUnits50m: mapUnits50m.collection,
    mapUnits10m: mapUnits10m.collection,
  });
  const output = new TextEncoder().encode(JSON.stringify(result.collection));

  await writeFile(OUTPUT_PATH, output);
  await writeFile(
    README_PATH,
    buildReadme({
      result,
      output,
      sources: {
        countries110m: countries110m.bytes,
        mapUnits50m: mapUnits50m.bytes,
        mapUnits10m: mapUnits10m.bytes,
      },
    }),
    "utf8",
  );

  console.log(
    `Built ${result.collection.features.length} features with ${result.officialIso3Count} official ISO3 codes (${result.pointCount} point fallbacks).`,
  );
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]!).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
