"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

import type {
  DatasetMapBoundaryCollection,
  DatasetMapCountryAggregate,
} from "@/lib/dataset-map-data";

type LeafletModule = typeof import("leaflet");

type DatasetCountryMapProps = {
  boundaries: DatasetMapBoundaryCollection;
  countries: readonly DatasetMapCountryAggregate[];
  selectedCountryIso3: string | null;
  onSelectCountry: (iso3: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

type RendererState = {
  leaflet: LeafletModule;
  map: LeafletMap;
};

export const DATASET_MAP_COUNT_FILL_COLORS = [
  "var(--dataset-map-count-low)",
  "var(--dataset-map-count-medium)",
  "var(--dataset-map-count-high)",
  "var(--dataset-map-count-maximum)",
] as const;

function getCountryFillColor(count: number, maximumCount: number) {
  if (count <= 0) {
    return "var(--dataset-map-empty)";
  }

  const ratio = maximumCount > 0 ? count / maximumCount : 0;

  if (ratio >= 0.75) return DATASET_MAP_COUNT_FILL_COLORS[3];
  if (ratio >= 0.5) return DATASET_MAP_COUNT_FILL_COLORS[2];
  if (ratio >= 0.25) return DATASET_MAP_COUNT_FILL_COLORS[1];
  return DATASET_MAP_COUNT_FILL_COLORS[0];
}

export function getCountryFeatureStyle(input: {
  count: number;
  maximumCount: number;
  selected: boolean;
}) {
  return {
    color: input.selected
      ? "var(--dataset-map-selected)"
      : "var(--dataset-map-boundary)",
    fillColor: getCountryFillColor(input.count, input.maximumCount),
    fillOpacity: input.count > 0 ? 0.86 : 0.42,
    opacity: 1,
    weight: input.selected ? 1.4 : 0.65,
  };
}

export function DatasetCountryMap({
  boundaries,
  countries,
  selectedCountryIso3,
  onSelectCountry,
  onReady,
  onError,
}: DatasetCountryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectCountryRef = useRef(onSelectCountry);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const hasFitWorldRef = useRef(false);
  const [renderer, setRenderer] = useState<RendererState | null>(null);
  const countryByIso3 = useMemo(
    () => new Map(countries.map((country) => [country.iso3, country] as const)),
    [countries],
  );
  const maximumCount = useMemo(
    () => Math.max(0, ...countries.map((country) => country.matchingRecordCount)),
    [countries],
  );

  useEffect(() => {
    onSelectCountryRef.current = onSelectCountry;
  }, [onSelectCountry]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let active = true;
    let map: LeafletMap | null = null;

    void import("leaflet")
      .then((leaflet) => {
        if (!active || !containerRef.current) {
          return;
        }

        map = leaflet.map(containerRef.current, {
          attributionControl: false,
          center: [12, 0],
          maxBounds: [
            [-90, -180],
            [90, 180],
          ],
          maxBoundsViscosity: 1,
          maxZoom: 6,
          minZoom: 1,
          scrollWheelZoom: true,
          worldCopyJump: false,
          zoom: 2,
        });
        setRenderer({ leaflet, map });
      })
      .catch(() => {
        if (active) {
          onErrorRef.current("The local map renderer could not be loaded.");
        }
      });

    return () => {
      active = false;
      hasFitWorldRef.current = false;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!renderer) {
      return;
    }

    const { leaflet, map } = renderer;
    const boundaryLayer = leaflet.geoJSON(boundaries, {
      style: (feature) => {
        const iso3 = feature?.properties?.iso3 ?? "";
        const count = countryByIso3.get(iso3)?.matchingRecordCount ?? 0;
        const selected = iso3 === selectedCountryIso3;

        return getCountryFeatureStyle({ count, maximumCount, selected });
      },
      pointToLayer: (feature, latlng) => {
        const iso3 = feature.properties?.iso3 ?? "";
        const count = countryByIso3.get(iso3)?.matchingRecordCount ?? 0;
        const selected = iso3 === selectedCountryIso3;

        return leaflet.circleMarker(latlng, {
          ...getCountryFeatureStyle({ count, maximumCount, selected }),
          radius: selected ? 6.5 : count > 0 ? 5 : 3.5,
        });
      },
      onEachFeature: (feature, layer) => {
        const iso3 = feature.properties?.iso3;
        const countryName = feature.properties?.name;

        if (typeof iso3 !== "string" || typeof countryName !== "string") {
          return;
        }

        const handleSelect = () => {
          const count = countryByIso3.get(iso3)?.matchingRecordCount ?? 0;
          if (layer instanceof leaflet.Path) {
            layer.setStyle(
              getCountryFeatureStyle({
                count,
                maximumCount,
                selected: true,
              }),
            );
            layer.bringToFront();
          }
          onSelectCountryRef.current(iso3);
        };

        layer.on("click", handleSelect);
        layer.once("add", () => {
          if (!(layer instanceof leaflet.Path)) {
            return;
          }

          const element = layer.getElement();
          element?.setAttribute("role", "button");
          element?.setAttribute("tabindex", "0");
          element?.setAttribute("aria-label", `Select ${countryName}`);
          element?.addEventListener("click", handleSelect);
          if (element instanceof HTMLElement || element instanceof SVGElement) {
            element.style.outline = "none";
          }
          element?.addEventListener("focus", () => {
            if (element instanceof HTMLElement || element instanceof SVGElement) {
              element.style.filter =
                "drop-shadow(0 0 2px var(--dataset-map-focus))";
            }
            layer.bringToFront();
          });
          element?.addEventListener("blur", () => {
            if (element instanceof HTMLElement || element instanceof SVGElement) {
              element.style.filter = "";
            }
          });
          element?.addEventListener("keydown", (event) => {
            if (
              event instanceof KeyboardEvent &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              onSelectCountryRef.current(iso3);
            }
          });
        });
      },
    });

    boundaryLayer.addTo(map);

    if (!hasFitWorldRef.current) {
      map.fitBounds(boundaryLayer.getBounds(), { padding: [12, 12] });
      hasFitWorldRef.current = true;
    }

    if (selectedCountryIso3) {
      for (const layer of boundaryLayer.getLayers()) {
        const feature = (layer as typeof layer & {
          feature?: { properties?: DatasetMapBoundaryCollection["features"][number]["properties"] };
        }).feature;

        if (
          feature?.properties?.iso3 !== selectedCountryIso3
        ) {
          continue;
        }

        if (layer instanceof leaflet.Polygon) {
          layer.bringToFront();
          map.fitBounds(layer.getBounds(), {
            maxZoom: 4,
            padding: [32, 32],
          });
          break;
        }

        if (layer instanceof leaflet.CircleMarker) {
          layer.bringToFront();
          map.setView(layer.getLatLng(), 4);
          break;
        }
      }
    }

    onReadyRef.current();

    return () => {
      boundaryLayer.removeFrom(map);
    };
  }, [boundaries, countryByIso3, maximumCount, renderer, selectedCountryIso3]);

  return (
    <div
      ref={containerRef}
      className="h-[30rem] w-full overflow-hidden rounded-xl bg-[var(--dataset-map-canvas)] sm:h-[36rem] lg:h-[40rem]"
      aria-label="Matching records by country"
    />
  );
}
