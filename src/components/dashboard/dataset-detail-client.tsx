"use client";

import { useMemo, useState } from "react";

import { DatasetTable } from "@/components/dashboard/dataset-table";
import { DatasetViewSwitchGrid } from "@/components/dashboard/dataset-view-switch-grid";
import type { DatasetSummary, FilterRegion } from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  getEnabledRegionCountryNames,
} from "@/lib/dataset-region-filtering";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  regions: FilterRegion[];
};

export function DatasetDetailClient({
  dataset,
  regions,
}: DatasetDetailClientProps) {
  const supportsRegionFiltering = datasetSupportsRegionFiltering(dataset);
  const canUseRegionFilter = supportsRegionFiltering && regions.length > 0;
  const [regionEnabled, setRegionEnabled] = useState(canUseRegionFilter);
  const [selectedRegionIds, setSelectedRegionIds] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        regions.map((region) => [region.id, canUseRegionFilter]),
      ),
  );
  const [watchlistEnabled, setWatchlistEnabled] = useState(false);
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
          onEnabledChange: setWatchlistEnabled,
        }}
        uupgCard={{
          enabled: uupgEnabled,
          onEnabledChange: setUupgEnabled,
        }}
      />
      <DatasetTable
        dataset={dataset}
        regionFilter={{
          enabled: regionEnabled,
          isSupported: supportsRegionFiltering,
          hasConfiguredRegions: regions.length > 0,
          enabledCountryNames,
        }}
      />
    </>
  );
}
