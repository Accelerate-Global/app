# Dataset map boundary data

`natural-earth-countries-110m.geojson` is the provider-free ISO3 boundary layer for the dataset map.

- Source release: Natural Earth `v5.1.2`
- Retrieved: 2026-08-26
- Polygon source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson>
- Point coordinate source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_map_units.geojson>
- Fallback point coordinate source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson>
- Terms: Natural Earth vector and raster data is public domain
- Terms URL: <https://www.naturalearthdata.com/about/terms-of-use/>
- 1:110m source SHA-256: `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`
- 1:50m source SHA-256: `b8d421aca6e9e08e8cdf09cc26af111cc3e0deba4fe915611d58ade71e8a4db0`
- 1:10m source SHA-256: `57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862`
- Output SHA-256: `51678254d9878b3256ee70a4a1b79319e3a81e660064f994e6e054b8b6208bb1`
- Output size: 264,126 bytes
- Gzip size from Node `gzipSync`: 96,842 bytes

## ISO3 coverage

- Official ISO3 codes in the AX catalog: 249
- 1:110m polygon features: 177
- Point fallbacks for omitted official codes: 75
- Total output features: 252
- Official ISO3 coverage: 100%

The builder preserves every 1:110m country geometry and retains only `iso3` and `name`. It then adds one GeoJSON Point for each official AX ISO3 omitted by the lightweight polygons, using pinned Natural Earth map-unit label coordinates. ISO3 values use `ISO_A3`, falling back to the relevant Natural Earth administrative code when needed.

The collection is compacted to one JSON line and loaded from the AX Online origin only after a user opens Map mode. Runtime tile, style, font, search, geocoding, and external boundary requests are prohibited.

Regenerate with `pnpm run data:build:dataset-map-boundaries`. Generation fails if official ISO3 coverage is incomplete or output codes are duplicated.

## Local MVP build footprint

The map UI and Leaflet remain lazy-loaded after the user selects Map mode. The bundled boundary asset adds only point coordinates for the official codes omitted by the 1:110m polygon source, preserving the free-tier-oriented payload.
