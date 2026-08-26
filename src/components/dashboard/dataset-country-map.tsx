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

function getCountryFillColor(count: number, maximumCount: number) {
  if (count <= 0) {
    return "#e2e8f0";
  }

  const ratio = maximumCount > 0 ? count / maximumCount : 0;

  if (ratio >= 0.75) return "#0f766e";
  if (ratio >= 0.5) return "#0d9488";
  if (ratio >= 0.25) return "#2dd4bf";
  return "#99f6e4";
}

function getCountryFeatureStyle(input: {
  count: number;
  maximumCount: number;
  selected: boolean;
}) {
  return {
    color: input.selected ? "#0f172a" : "#ffffff",
    fillColor: getCountryFillColor(input.count, input.maximumCount),
    fillOpacity: input.count > 0 ? 0.86 : 0.42,
    opacity: 1,
    weight: input.selected ? 2.5 : 0.8,
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
          radius: selected ? 7 : count > 0 ? 5 : 3.5,
        });
      },
      onEachFeature: (feature, layer) => {
        const iso3 = feature.properties?.iso3;
        const countryName = feature.properties?.name;

        if (typeof iso3 !== "string" || typeof countryName !== "string") {
          return;
        }

        layer.on("click", () => onSelectCountryRef.current(iso3));
        layer.once("add", () => {
          if (!(layer instanceof leaflet.Path)) {
            return;
          }

          const element = layer.getElement();
          element?.setAttribute("role", "button");
          element?.setAttribute("tabindex", "0");
          element?.setAttribute("aria-label", `Select ${countryName}`);
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
          map.fitBounds(layer.getBounds(), {
            maxZoom: 4,
            padding: [32, 32],
          });
          break;
        }

        if (layer instanceof leaflet.CircleMarker) {
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
      className="h-[28rem] w-full overflow-hidden rounded-xl bg-slate-100 sm:h-[34rem]"
      aria-label="Matching records by country"
    />
  );
}
