"use client";

import { useMemo, useState } from "react";

import { DatasetTable } from "@/components/dashboard/dataset-table";
import { DatasetViewSwitchGrid } from "@/components/dashboard/dataset-view-switch-grid";
import type { DatasetSummary, FilterRegion } from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  datasetSupportsUupgFiltering,
  getEnabledRegionCountryNames,
} from "@/lib/dataset-region-filtering";

type DatasetDetailClientProps = {
  dataset: DatasetSummary;
  regions: FilterRegion[];
  fieldDefinitionDescriptionsByColumnKey: Record<string, string>;
};

export function DatasetDetailClient({
  dataset,
  regions,
  fieldDefinitionDescriptionsByColumnKey,
}: DatasetDetailClientProps) {
  const supportsRegionFiltering = datasetSupportsRegionFiltering(dataset);
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
          onEnabledChange: setWatchlistEnabled,
        }}
        uupgCard={{
          enabled: uupgEnabled,
          supported: supportsUupgFiltering,
          onEnabledChange: setUupgEnabled,
        }}
      />
      <DatasetTable
        dataset={dataset}
        fieldDefinitionDescriptionsByColumnKey={fieldDefinitionDescriptionsByColumnKey}
        regionFilter={{
          enabled: regionEnabled,
          isSupported: supportsRegionFiltering,
          hasConfiguredRegions: regions.length > 0,
          enabledCountryNames,
        }}
        uupgFilter={{
          enabled: uupgEnabled,
          isSupported: supportsUupgFiltering,
        }}
      />
    </>
  );
}
