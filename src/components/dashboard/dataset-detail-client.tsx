"use client";

import { useMemo, useState } from "react";

import { DatasetTable } from "@/components/dashboard/dataset-table";
import { DatasetViewSwitchGrid } from "@/components/dashboard/dataset-view-switch-grid";
import type {
  DatasetSummary,
  FieldDefinitionPresentation,
  FilterRegion,
} from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  getEnabledRegionCountryNames,
} from "@/lib/dataset-region-filtering";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  regions: FilterRegion[];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
};

const WATCHLIST_THRESHOLD_DEFAULT = 2;
const WATCHLIST_THRESHOLD_MIN = 0;
const WATCHLIST_THRESHOLD_MAX = 6;
const WATCHLIST_FRONTIER_GROUP_VALUE_DEFAULT = true;

function clampWatchlistThreshold(value: number) {
  return Math.min(
    WATCHLIST_THRESHOLD_MAX,
    Math.max(WATCHLIST_THRESHOLD_MIN, Math.round(value)),
  );
}

export function DatasetDetailClient({
  dataset,
  regions,
  fieldDefinitionPresentationByColumnKey,
}: DatasetDetailClientProps) {
  const supportsRegionFiltering = datasetSupportsRegionFiltering(dataset);
  const supportsWatchlistFiltering = datasetSupportsWatchlistFiltering(dataset);
  const supportsUupgFiltering = datasetSupportsUupgFiltering(dataset);
  const canUseRegionFilter = supportsRegionFiltering && regions.length > 0;
  const [regionEnabled, setRegionEnabled] = useState(canUseRegionFilter);
  const [selectedRegionIds, setSelectedRegionIds] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        regions.map((region) => [region.id, canUseRegionFilter]),
      ),
  );
  const [watchlistEnabled, setWatchlistEnabled] = useState(false);
  const [watchlistThreshold, setWatchlistThreshold] = useState(
    WATCHLIST_THRESHOLD_DEFAULT,
  );
  const [watchlistFrontierGroupValue, setWatchlistFrontierGroupValue] = useState(
    WATCHLIST_FRONTIER_GROUP_VALUE_DEFAULT,
  );
  const [uupgEnabled, setUupgEnabled] = useState(false);

  const enabledCountryNames = useMemo(
    () => getEnabledRegionCountryNames(regions, selectedRegionIds),
    [regions, selectedRegionIds],
  );
  const regionSelectors = useMemo(
    () =>
      regions.map((region) => ({
        id: region.id,
        label: region.name,
        checked: selectedRegionIds[region.id] ?? false,
        description: region.description,
        countries: region.countries,
      })),
    [regions, selectedRegionIds],
  );

  return (
    <>
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: regionEnabled,
          supported: supportsRegionFiltering,
          selectors: regionSelectors,
          onEnabledChange: setRegionEnabled,
          onSelectorChange: (regionId, checked) =>
            setSelectedRegionIds((current) => ({
              ...current,
              [regionId]: checked,
            })),
        }}
        watchlistCard={{
          enabled: watchlistEnabled,
          supported: supportsWatchlistFiltering,
          threshold: watchlistThreshold,
          minThreshold: WATCHLIST_THRESHOLD_MIN,
          maxThreshold: WATCHLIST_THRESHOLD_MAX,
          frontierGroupValue: watchlistFrontierGroupValue,
          onEnabledChange: setWatchlistEnabled,
          onThresholdChange: (value) =>
            setWatchlistThreshold(clampWatchlistThreshold(value)),
          onFrontierGroupValueChange: setWatchlistFrontierGroupValue,
        }}
        uupgCard={{
          enabled: uupgEnabled,
          supported: supportsUupgFiltering,
          onEnabledChange: setUupgEnabled,
        }}
      />
      <DatasetTable
        dataset={dataset}
        fieldDefinitionPresentationByColumnKey={fieldDefinitionPresentationByColumnKey}
        regionFilter={{
          enabled: regionEnabled,
          isSupported: supportsRegionFiltering,
          hasConfiguredRegions: regions.length > 0,
          enabledCountryNames,
        }}
        watchlistFilter={{
          enabled: watchlistEnabled,
          isSupported: supportsWatchlistFiltering,
          threshold: watchlistThreshold,
          frontierGroupValue: watchlistFrontierGroupValue,
        }}
        uupgFilter={{
          enabled: uupgEnabled,
          isSupported: supportsUupgFiltering,
        }}
      />
    </>
  );
}
