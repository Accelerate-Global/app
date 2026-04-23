"use client";

import {
  ChevronDownIcon,
  FlameIcon,
  InfoIcon,
  MapIcon,
  MapPinnedIcon,
  MicroscopeIcon,
  UserRoundIcon,
} from "lucide-react";
import { memo, useState, type ReactNode } from "react";

import { CountrySearchSelector } from "@/components/dashboard/country-search-selector";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/reui/number-field";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  DatasetHotspotsMetric,
  WatchlistEngagementPhaseRule,
  WatchlistJpOnlyEvangelicalRule,
} from "@/lib/api-types";
import {
  isGlobalRegionName,
  normalizeRegionDisplayName,
  normalizeRegionDisplayText,
} from "@/lib/region-display";
import { WATCHLIST_THRESHOLD_MAX } from "@/lib/saved-dataset-filters";
import {
  WATCHLIST_ENGAGEMENT_PHASE_RULE_MAX,
  WATCHLIST_ENGAGEMENT_PHASE_RULE_MIN,
} from "@/lib/watchlist-engagement-phase";
import {
  WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_BELIEVERS,
  WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_PERCENT_EVANGELICAL,
} from "@/lib/watchlist-jp-only-evangelical";
import { cn } from "@/lib/utils";

type RegionSelector = {
  id: string;
  label: string;
  checked: boolean;
  description: string;
  countries: string[];
};

type DatasetViewSwitchGridProps = {
  className?: string;
  regionCard: {
    supported: boolean;
    selectors: RegionSelector[];
    onSelectorChange: (regionId: string, checked: boolean) => void;
  };
  countryCard: {
    enabled: boolean;
    supported: boolean;
    searchValue: string;
    availableCountries: string[];
    selectedCountries: string[];
    hasExplicitSelection?: boolean;
    visibleCountries?: string[];
    includeAlternateCountries: boolean;
    supportsAlternateCountries: boolean;
    onEnabledChange: (checked: boolean) => void;
    onIncludeAlternateCountriesChange: (checked: boolean) => void;
    onSearchChange: (value: string) => void;
    onToggleCountry: (country: string, checked: boolean) => void;
    onSelectVisible: (countries: string[]) => void;
    onClearVisible: (countries: string[]) => void;
  };
  watchlistCard: {
    enabled: boolean;
    supported: boolean;
    thresholdDefinition: string;
    thresholdEnabled: boolean;
    threshold: number;
    thresholdIsDefault: boolean;
    jpOnlyEvangelicalCriteriaEnabled: boolean;
    jpOnlyEvangelicalCriteriaSupported: boolean;
    jpOnlyEvangelicalCriteriaLabel: string;
    jpOnlyEvangelicalCriteriaDefinition: string;
    jpOnlyEvangelicalCriteriaSummary: string;
    jpOnlyEvangelicalRule: WatchlistJpOnlyEvangelicalRule;
    jpOnlyEvangelicalRuleIsDefault: boolean;
    engagementPhaseEnabled: boolean;
    engagementPhaseLabel: string;
    engagementPhaseDefinition: string;
    engagementPhaseRule: WatchlistEngagementPhaseRule;
    engagementPhaseRuleIsDefault: boolean;
    engagementPhaseSummary: string;
    onEnabledChange: (checked: boolean) => void;
    onThresholdEnabledChange: (checked: boolean) => void;
    onThresholdChange: (value: number) => void;
    onThresholdReset: () => void;
    onEngagementPhaseEnabledChange: (checked: boolean) => void;
    onEngagementPhaseRuleChange: (rule: WatchlistEngagementPhaseRule) => void;
    onEngagementPhaseRuleReset: () => void;
    onJpOnlyEvangelicalCriteriaEnabledChange: (checked: boolean) => void;
    onJpOnlyEvangelicalRuleChange: (rule: WatchlistJpOnlyEvangelicalRule) => void;
    onJpOnlyEvangelicalRuleReset: () => void;
  };
  uupgCard: {
    enabled: boolean;
    supported: boolean;
    globalEngagementAnywhereLabel: string;
    globalEngagementAnywhereDefinition: string;
    globalEngagementAnywhereEnabled: boolean;
    frontierGroupSupported: boolean;
    frontierGroupLabel: string;
    frontierGroupDefinition: string;
    frontierGroupEnabled: boolean;
    onEnabledChange: (checked: boolean) => void;
    onGlobalEngagementAnywhereEnabledChange: (checked: boolean) => void;
    onFrontierGroupEnabledChange: (checked: boolean) => void;
  };
  hotspotsCard: {
    enabled: boolean;
    supported: boolean;
    metric: DatasetHotspotsMetric;
    countryCount: number;
    minCountryCount: number;
    maxCountryCount: number;
    onEnabledChange: (checked: boolean) => void;
    onMetricChange: (metric: DatasetHotspotsMetric) => void;
    onCountryCountChange: (value: number) => void;
  };
};

type FilterSectionId =
  | "region"
  | "country"
  | "watchlist"
  | "uupg"
  | "hotspots";

const FILTER_PANEL_DESCRIPTIONS = {
  region: "A grouping of people groups based on geography.",
  country: "Filter people groups by country.",
  watchlist:
    "People groups unengaged or would be unengaged if the current mission work stopped today.",
  uupg:
    "Configure the criteria used for UUPG filtering.",
  hotspots:
    "Rank primary countries ranked by UUPG density.",
} as const;

const INFO_TOOLTIP_CONTENT_CLASSNAME =
  "max-w-[26rem] rounded-2xl border border-border/80 bg-popover px-4 py-3.5 text-sm leading-6 text-popover-foreground shadow-lg ring-1 ring-foreground/8";
const WATCHLIST_THRESHOLD_FILTER_LABEL = "GSEC (IMB-only)";
const WATCHLIST_RULE_GRID_CLASSNAME =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3";

function RegionCountriesInfo({
  label,
  description,
  countries,
}: {
  label: string;
  description: string;
  countries: string[];
}) {
  const displayLabel = normalizeRegionDisplayName(label);
  const tooltipText = getRegionTooltipText(label, description, countries);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`View countries in ${displayLabel}`}
            data-smoke-trigger="region-tooltip"
            data-smoke-write="safe"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className={INFO_TOOLTIP_CONTENT_CLASSNAME}
        data-smoke-surface="region-tooltip"
        data-smoke-ready="region-tooltip"
      >
        <div className="space-y-1.5 text-left">
          <p className="font-medium tracking-[-0.01em] text-popover-foreground">
            {displayLabel}
          </p>
          <p className="whitespace-pre-line text-popover-foreground">
            {tooltipText}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function getRegionTooltipText(
  label: string,
  description: string,
  countries: string[],
) {
  const trimmedDescription = description.trim();

  if (trimmedDescription) {
    return normalizeRegionDisplayText(trimmedDescription);
  }

  if (isGlobalRegionName(label)) {
    return "All countries.";
  }

  return countries.join(", ");
}

function FieldDefinitionInfo({
  label,
  definition,
}: {
  label: string;
  definition: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`View definition for ${label}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className={INFO_TOOLTIP_CONTENT_CLASSNAME}>
        <div className="space-y-1.5 text-left">
          <p className="font-medium tracking-[-0.01em] text-popover-foreground">
            {label}
          </p>
          <p className="whitespace-pre-line text-popover-foreground">
            {definition}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function FilterExpressionLabel({
  label,
  definition,
}: {
  label: string;
  definition: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]">
        {label}
      </span>
      <FieldDefinitionInfo label={label} definition={definition} />
    </div>
  );
}

function DatasetFilterRow({
  label,
  definition,
  children,
  controlClassName,
  toggleControl,
}: {
  label: string;
  definition: string;
  children?: ReactNode;
  controlClassName?: string;
  toggleControl?: ReactNode;
}) {
  return (
    <div className="space-y-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FilterExpressionLabel label={label} definition={definition} />
        </div>
        {toggleControl ? <div className="shrink-0 pt-0.5">{toggleControl}</div> : null}
      </div>
      {children ? (
        <div className={cn("w-full", controlClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function DatasetFilterNumberControl({
  label,
  value,
  min,
  max,
  operator,
  disabled,
  onValueChange,
  step = 1,
  smallStep = 1,
  largeStep = 1,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  operator: "<" | "<=" | ">=";
  disabled: boolean;
  onValueChange: (value: number) => void;
  step?: number;
  smallStep?: number;
  largeStep?: number;
  className?: string;
}) {
  return (
    <NumberField
      value={value}
      min={min}
      max={max}
      step={step}
      smallStep={smallStep}
      largeStep={largeStep}
      snapOnStep
      disabled={disabled}
      onValueChange={(nextValue) => onValueChange(nextValue ?? min)}
      className={cn("w-full sm:w-[10rem]", className)}
    >
      <NumberFieldGroup className="h-10 overflow-hidden rounded-xl border-border/70 bg-background/80 text-foreground shadow-xs shadow-black/5 focus-within:border-foreground/20 focus-within:ring-foreground/10">
        <span
          aria-hidden="true"
          data-slot="number-field-operator"
          className="flex shrink-0 items-center justify-center border-r border-border/70 px-2 text-sm font-semibold tracking-[-0.02em] text-foreground/70"
        >
          {operator}
        </span>
        <NumberFieldDecrement
          className="rounded-none border-r border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          aria-label={`Decrease ${label}`}
        />
        <NumberFieldInput
          className="border-r border-border/70 px-3 text-center text-sm font-semibold tracking-[-0.02em] text-foreground"
          aria-label={label}
        />
        <NumberFieldIncrement
          className="rounded-none border-0 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          aria-label={`Increase ${label}`}
        />
      </NumberFieldGroup>
    </NumberField>
  );
}

function DatasetFilterNumberField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function FilterSection({
  id,
  title,
  icon,
  summary,
  description,
  expanded,
  titleAccessory,
  notice,
  toggleControl,
  onExpandedChange,
  children,
}: {
  id: FilterSectionId;
  title: string;
  icon: ReactNode;
  summary: string[];
  description: string;
  expanded: boolean;
  titleAccessory?: ReactNode;
  notice?: ReactNode;
  toggleControl?: ReactNode;
  onExpandedChange: (expanded: boolean) => void;
  children?: ReactNode;
}) {
  const panelId = `${id}-filter-panel`;

  return (
    <section className="rounded-[1.1rem] border border-border/70 bg-background/80 shadow-xs shadow-black/5">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${title} filters`}
          className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </span>
              {titleAccessory}
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition-colors group-hover:border-foreground/20 group-hover:text-foreground",
                  expanded ? "border-foreground/20 text-foreground" : "",
                )}
              >
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    expanded ? "rotate-180" : "",
                  )}
                />
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">
              {summary.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </button>
        {toggleControl ? <div className="shrink-0 pt-0.5">{toggleControl}</div> : null}
      </div>
      {expanded ? (
        <div id={panelId} className="border-t border-border/70 px-3 pb-3 pt-3">
          <div className="space-y-3">
            <p className="text-sm leading-5 text-muted-foreground">{description}</p>
            {notice}
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getRegionSummary(regionCard: DatasetViewSwitchGridProps["regionCard"]) {
  if (!regionCard.supported) {
    return ["Unavailable"];
  }

  const visibleSelectors = regionCard.selectors;

  if (visibleSelectors.length === 0) {
    return ["No regions configured"];
  }

  const globalSelector = visibleSelectors.find((selector) =>
    isGlobalRegionName(selector.label),
  );

  if (globalSelector?.checked) {
    return ["Global"];
  }

  const selectedCount = visibleSelectors.filter((selector) => selector.checked).length;

  if (selectedCount === 0) {
    return ["Off"];
  }

  return [`${selectedCount} selected`];
}

function getWatchlistSummary(
  watchlistCard: DatasetViewSwitchGridProps["watchlistCard"],
) {
  if (!watchlistCard.supported) {
    return ["Unavailable"];
  }

  if (!watchlistCard.enabled) {
    return ["Off"];
  }

  const summary: string[] = [];

  if (watchlistCard.thresholdEnabled) {
    summary.push(
      `${WATCHLIST_THRESHOLD_FILTER_LABEL} <= ${watchlistCard.threshold}`,
    );
  }

  if (
    watchlistCard.jpOnlyEvangelicalCriteriaSupported &&
    watchlistCard.jpOnlyEvangelicalCriteriaEnabled
  ) {
    summary.push(watchlistCard.jpOnlyEvangelicalCriteriaSummary);
  }

  if (watchlistCard.engagementPhaseEnabled) {
    summary.push(watchlistCard.engagementPhaseSummary);
  }

  return summary.length > 0 ? summary : ["No criteria selected"];
}

function getCountrySummary(countryCard: DatasetViewSwitchGridProps["countryCard"]) {
  if (!countryCard.supported) {
    return ["Unavailable"];
  }

  if (countryCard.availableCountries.length === 0) {
    return ["No visible countries"];
  }

  const visibleCountryCount =
    countryCard.visibleCountries?.length ?? countryCard.availableCountries.length;

  if (!countryCard.hasExplicitSelection) {
    return [
      `${visibleCountryCount} visible ${
        visibleCountryCount === 1 ? "country" : "countries"
      }`,
    ];
  }

  const selectedCountryCount = countryCard.selectedCountries.length;

  return [
    `${selectedCountryCount} selected ${
      selectedCountryCount === 1 ? "country" : "countries"
    }`,
  ];
}

function getUupgSummary(uupgCard: DatasetViewSwitchGridProps["uupgCard"]) {
  if (!uupgCard.supported) {
    return ["Unavailable"];
  }

  if (!uupgCard.enabled) {
    return ["Off"];
  }

  const summary: string[] = [];

  if (uupgCard.globalEngagementAnywhereEnabled) {
    summary.push(uupgCard.globalEngagementAnywhereLabel);
  }

  if (uupgCard.frontierGroupSupported && uupgCard.frontierGroupEnabled) {
    summary.push(uupgCard.frontierGroupLabel);
  }

  return summary.length > 0 ? summary : ["No criteria selected"];
}

function getHotspotsMetricLabel(metric: DatasetHotspotsMetric) {
  return metric === "population" ? "UUPG population" : "unique UUPGs";
}

function getHotspotsSummary(
  hotspotsCard: DatasetViewSwitchGridProps["hotspotsCard"],
) {
  if (!hotspotsCard.supported) {
    return ["Unavailable"];
  }

  if (!hotspotsCard.enabled) {
    return ["Off"];
  }

  return [
    `Top ${hotspotsCard.countryCount} countries by ${getHotspotsMetricLabel(hotspotsCard.metric)}`,
  ];
}

function DatasetViewSwitchGridInner({
  className,
  regionCard,
  countryCard,
  watchlistCard,
  uupgCard,
  hotspotsCard,
}: DatasetViewSwitchGridProps) {
  const primaryUupgFieldLabel = uupgCard.globalEngagementAnywhereLabel;
  const visibleRegionSelectors = regionCard.selectors;
  const hasRegions = visibleRegionSelectors.length > 0;
  const [expandedSections, setExpandedSections] = useState<
    Record<FilterSectionId, boolean>
  >({
    region: false,
    country: false,
    watchlist: false,
    uupg: false,
    hotspots: false,
  });
  const enableCountryFilter = () => {
    if (!countryCard.enabled) {
      countryCard.onEnabledChange(true);
    }
  };
  const enabledUupgCriteriaCount =
    Number(uupgCard.globalEngagementAnywhereEnabled) +
    Number(uupgCard.frontierGroupSupported && uupgCard.frontierGroupEnabled);
  const disableGlobalEngagementAnywhereToggle =
    !uupgCard.enabled ||
    (uupgCard.globalEngagementAnywhereEnabled && enabledUupgCriteriaCount === 1);
  const disableFrontierGroupToggle =
    !uupgCard.enabled ||
    !uupgCard.frontierGroupSupported ||
    (uupgCard.frontierGroupEnabled && enabledUupgCriteriaCount === 1);
  const thresholdControlsDisabled =
    !watchlistCard.enabled || !watchlistCard.thresholdEnabled;
  const engagementPhaseRuleControlsDisabled =
    !watchlistCard.enabled || !watchlistCard.engagementPhaseEnabled;
  const jpOnlyRuleControlsDisabled =
    !watchlistCard.enabled || !watchlistCard.jpOnlyEvangelicalCriteriaEnabled;

  return (
    <div
      className={cn(
        "rounded-[1.25rem] border border-border/80 bg-card/95 shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border/70 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Filters
        </p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Expand a section to review its description and adjust the table.
        </p>
      </div>
      <div className="space-y-3 p-3">
        <FilterSection
          id="region"
          title="Region"
          icon={<MapIcon aria-hidden="true" className="size-5" />}
          summary={getRegionSummary(regionCard)}
          description={FILTER_PANEL_DESCRIPTIONS.region}
          expanded={expandedSections.region}
          onExpandedChange={(expanded) =>
            setExpandedSections((current) => ({ ...current, region: expanded }))
          }
        >
          {!regionCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include <code>Geo_Country_Name</code>, so region
              filtering is unavailable.
            </p>
          ) : !hasRegions ? (
            <p className="text-sm leading-5 text-muted-foreground">
              No regions have been configured yet.
            </p>
          ) : (
            <div className="divide-y divide-border/70 px-3">
              {visibleRegionSelectors.map((selector) => {
                const displayLabel = normalizeRegionDisplayName(selector.label);

                return (
                  <div
                    key={selector.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {displayLabel}
                        </p>
                        <RegionCountriesInfo
                          label={selector.label}
                          description={selector.description}
                          countries={selector.countries}
                        />
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      checked={selector.checked}
                      onCheckedChange={(checked) =>
                        regionCard.onSelectorChange(selector.id, checked)
                      }
                      aria-label={`Toggle ${displayLabel}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </FilterSection>

        <FilterSection
          id="country"
          title="Country"
          icon={<MapPinnedIcon aria-hidden="true" className="size-5" />}
          summary={getCountrySummary(countryCard)}
          description={FILTER_PANEL_DESCRIPTIONS.country}
          expanded={expandedSections.country}
          onExpandedChange={(expanded) =>
            setExpandedSections((current) => ({ ...current, country: expanded }))
          }
        >
          {!countryCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include <code>Geo_Country_Name</code>, so country
              filtering is unavailable.
            </p>
          ) : countryCard.availableCountries.length === 0 ? (
            <p className="text-sm leading-5 text-muted-foreground">
              No countries are visible for the current filters.
            </p>
          ) : (
            <div className="space-y-3 px-3">
              {countryCard.supportsAlternateCountries ? (
                <DatasetFilterRow
                  label="Alternate-country matching"
                  definition="When enabled, country options and matches can come from both Geo_Country_Name and Alternate_Countries."
                  toggleControl={
                    <Switch
                      size="sm"
                      checked={countryCard.includeAlternateCountries}
                      onCheckedChange={countryCard.onIncludeAlternateCountriesChange}
                      aria-label="Toggle Alternate-country matching"
                    />
                  }
                />
              ) : null}
              <CountrySearchSelector
                allCountries={countryCard.availableCountries}
                selectedCountries={countryCard.selectedCountries}
                visibleCountries={countryCard.visibleCountries}
                searchValue={countryCard.searchValue}
                disabled={false}
                showSelectionSummary={false}
                selectActionLabel="Select all"
                selectActionCountries={countryCard.availableCountries}
                clearActionLabel="Deselect all"
                clearActionCountries={countryCard.availableCountries}
                onSearchChange={countryCard.onSearchChange}
                onToggleCountry={(country, checked) => {
                  if (checked) {
                    enableCountryFilter();
                  }

                  countryCard.onToggleCountry(country, checked);
                }}
                onSelectVisible={(countryNames) => {
                  if (countryNames.length > 0) {
                    enableCountryFilter();
                  }

                  countryCard.onSelectVisible(countryNames);
                }}
                onClearVisible={(countryNames) => {
                  if (countryNames.length > 0) {
                    enableCountryFilter();
                  }

                  countryCard.onClearVisible(countryNames);
                }}
              />
            </div>
          )}
        </FilterSection>

        <FilterSection
          id="watchlist"
          title="Watchlist"
          icon={<MicroscopeIcon aria-hidden="true" className="size-5" />}
          summary={getWatchlistSummary(watchlistCard)}
          description={FILTER_PANEL_DESCRIPTIONS.watchlist}
          expanded={expandedSections.watchlist}
          onExpandedChange={(expanded) =>
            setExpandedSections((current) => ({ ...current, watchlist: expanded }))
          }
          toggleControl={
            <Switch
              size="sm"
              checked={watchlistCard.enabled}
              disabled={!watchlistCard.supported}
              onCheckedChange={watchlistCard.onEnabledChange}
              aria-label="Toggle Watchlist"
            />
          }
        >
          {!watchlistCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include the fields required for Watchlist
              filtering.
            </p>
          ) : (
            <div className="divide-y divide-border/70 px-3">
              <DatasetFilterRow
                label={WATCHLIST_THRESHOLD_FILTER_LABEL}
                definition={watchlistCard.thresholdDefinition}
                controlClassName="space-y-3"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.thresholdEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={watchlistCard.onThresholdEnabledChange}
                    aria-label={`Toggle Watchlist ${WATCHLIST_THRESHOLD_FILTER_LABEL}`}
                  />
                }
              >
                <div className={WATCHLIST_RULE_GRID_CLASSNAME}>
                  <DatasetFilterNumberControl
                    label="Watchlist GSEC max"
                    value={watchlistCard.threshold}
                    min={0}
                    max={WATCHLIST_THRESHOLD_MAX}
                    operator="<="
                    disabled={thresholdControlsDisabled}
                    onValueChange={watchlistCard.onThresholdChange}
                    className="sm:w-full"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={watchlistCard.thresholdIsDefault}
                    onClick={watchlistCard.onThresholdReset}
                  >
                    Reset defaults
                  </Button>
                </div>
              </DatasetFilterRow>
              {watchlistCard.jpOnlyEvangelicalCriteriaSupported ? (
                <DatasetFilterRow
                  label={watchlistCard.jpOnlyEvangelicalCriteriaLabel}
                  definition={watchlistCard.jpOnlyEvangelicalCriteriaDefinition}
                  controlClassName="space-y-3"
                  toggleControl={
                    <Switch
                      size="sm"
                      checked={watchlistCard.jpOnlyEvangelicalCriteriaEnabled}
                      disabled={!watchlistCard.enabled}
                      onCheckedChange={
                        watchlistCard.onJpOnlyEvangelicalCriteriaEnabledChange
                      }
                      aria-label={`Toggle Watchlist ${watchlistCard.jpOnlyEvangelicalCriteriaLabel}`}
                    />
                  }
                >
                  <div className={WATCHLIST_RULE_GRID_CLASSNAME}>
                    <DatasetFilterNumberField label="Keep below">
                      <DatasetFilterNumberControl
                        label="JP-only believer floor"
                        value={watchlistCard.jpOnlyEvangelicalRule.minBelievers}
                        min={0}
                        max={WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_BELIEVERS}
                        operator="<"
                        disabled={jpOnlyRuleControlsDisabled}
                        onValueChange={(minBelievers) =>
                          watchlistCard.onJpOnlyEvangelicalRuleChange({
                            ...watchlistCard.jpOnlyEvangelicalRule,
                            minBelievers,
                          })
                        }
                        className="sm:w-full"
                      />
                    </DatasetFilterNumberField>
                    <DatasetFilterNumberField label="Max population">
                      <DatasetFilterNumberControl
                        label="JP-only believer ceiling"
                        value={watchlistCard.jpOnlyEvangelicalRule.maxBelievers}
                        min={watchlistCard.jpOnlyEvangelicalRule.minBelievers}
                        max={WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_BELIEVERS}
                        operator="<="
                        disabled={jpOnlyRuleControlsDisabled}
                        onValueChange={(maxBelievers) =>
                          watchlistCard.onJpOnlyEvangelicalRuleChange({
                            ...watchlistCard.jpOnlyEvangelicalRule,
                            maxBelievers,
                          })
                        }
                        className="sm:w-full"
                      />
                    </DatasetFilterNumberField>
                    <DatasetFilterNumberField label="Max evangelical %">
                      <DatasetFilterNumberControl
                        label="JP-only max evangelical percent"
                        value={
                          watchlistCard.jpOnlyEvangelicalRule.maxPercentEvangelical
                        }
                        min={0}
                        max={WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_PERCENT_EVANGELICAL}
                        operator="<="
                        disabled={jpOnlyRuleControlsDisabled}
                        onValueChange={(maxPercentEvangelical) =>
                          watchlistCard.onJpOnlyEvangelicalRuleChange({
                            ...watchlistCard.jpOnlyEvangelicalRule,
                            maxPercentEvangelical,
                          })
                        }
                        step={0.01}
                        smallStep={0.01}
                        largeStep={0.1}
                        className="sm:w-full"
                      />
                    </DatasetFilterNumberField>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={watchlistCard.jpOnlyEvangelicalRuleIsDefault}
                      onClick={watchlistCard.onJpOnlyEvangelicalRuleReset}
                    >
                      Reset defaults
                    </Button>
                  </div>
                </DatasetFilterRow>
              ) : null}
              <DatasetFilterRow
                label={watchlistCard.engagementPhaseLabel}
                definition={watchlistCard.engagementPhaseDefinition}
                controlClassName="space-y-3"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.engagementPhaseEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={watchlistCard.onEngagementPhaseEnabledChange}
                    aria-label={`Toggle Watchlist ${watchlistCard.engagementPhaseLabel}`}
                  />
                }
              >
                <div className="space-y-1.5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Phase range
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <DatasetFilterNumberControl
                      label="Watchlist engagement min phase"
                      value={watchlistCard.engagementPhaseRule.minPhase}
                      min={WATCHLIST_ENGAGEMENT_PHASE_RULE_MIN}
                      max={WATCHLIST_ENGAGEMENT_PHASE_RULE_MAX}
                      operator=">="
                      disabled={engagementPhaseRuleControlsDisabled}
                      onValueChange={(minPhase) =>
                        watchlistCard.onEngagementPhaseRuleChange({
                          ...watchlistCard.engagementPhaseRule,
                          minPhase,
                        })
                      }
                      className="sm:w-full"
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      to
                    </span>
                    <DatasetFilterNumberControl
                      label="Watchlist engagement max phase"
                      value={watchlistCard.engagementPhaseRule.maxPhase}
                      min={watchlistCard.engagementPhaseRule.minPhase}
                      max={WATCHLIST_ENGAGEMENT_PHASE_RULE_MAX}
                      operator="<="
                      disabled={engagementPhaseRuleControlsDisabled}
                      onValueChange={(maxPhase) =>
                        watchlistCard.onEngagementPhaseRuleChange({
                          ...watchlistCard.engagementPhaseRule,
                          maxPhase,
                        })
                      }
                      className="sm:w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={watchlistCard.engagementPhaseRuleIsDefault}
                    onClick={watchlistCard.onEngagementPhaseRuleReset}
                  >
                    Reset defaults
                  </Button>
                </div>
              </DatasetFilterRow>
            </div>
          )}
        </FilterSection>

        <FilterSection
          id="uupg"
          title="UUPG"
          icon={<UserRoundIcon aria-hidden="true" className="size-5" />}
          summary={getUupgSummary(uupgCard)}
          description={FILTER_PANEL_DESCRIPTIONS.uupg}
          expanded={expandedSections.uupg}
          onExpandedChange={(expanded) =>
            setExpandedSections((current) => ({ ...current, uupg: expanded }))
          }
          toggleControl={
            <Switch
              size="sm"
              checked={uupgCard.enabled}
              disabled={!uupgCard.supported}
              onCheckedChange={uupgCard.onEnabledChange}
              aria-label="Toggle UUPG"
            />
          }
        >
          {!uupgCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include <code>{primaryUupgFieldLabel}</code>,
              so UUPG filtering is unavailable.
            </p>
          ) : (
            <div className="divide-y divide-border/70 px-3">
              <DatasetFilterRow
                label={uupgCard.globalEngagementAnywhereLabel}
                definition={uupgCard.globalEngagementAnywhereDefinition}
                toggleControl={
                  <Switch
                    size="sm"
                    checked={uupgCard.globalEngagementAnywhereEnabled}
                    disabled={disableGlobalEngagementAnywhereToggle}
                    onCheckedChange={
                      uupgCard.onGlobalEngagementAnywhereEnabledChange
                    }
                    aria-label={`Toggle UUPG ${uupgCard.globalEngagementAnywhereLabel}`}
                  />
                }
              />
              {uupgCard.frontierGroupSupported ? (
                <DatasetFilterRow
                  label={uupgCard.frontierGroupLabel}
                  definition={uupgCard.frontierGroupDefinition}
                  toggleControl={
                    <Switch
                      size="sm"
                      checked={uupgCard.frontierGroupEnabled}
                      disabled={disableFrontierGroupToggle}
                      onCheckedChange={uupgCard.onFrontierGroupEnabledChange}
                      aria-label={`Toggle UUPG ${uupgCard.frontierGroupLabel}`}
                    />
                  }
                />
              ) : null}
            </div>
          )}
        </FilterSection>

        <FilterSection
          id="hotspots"
          title="Hotspots"
          icon={<FlameIcon aria-hidden="true" className="size-5" />}
          summary={getHotspotsSummary(hotspotsCard)}
          description={FILTER_PANEL_DESCRIPTIONS.hotspots}
          expanded={expandedSections.hotspots}
          onExpandedChange={(expanded) =>
            setExpandedSections((current) => ({ ...current, hotspots: expanded }))
          }
          toggleControl={
            <Switch
              size="sm"
              checked={hotspotsCard.enabled}
              disabled={!hotspotsCard.supported}
              onCheckedChange={hotspotsCard.onEnabledChange}
              aria-label="Toggle Hotspots"
            />
          }
        >
          {!hotspotsCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include the fields required for Hotspots
              filtering.
            </p>
          ) : (
            <div className="divide-y divide-border/70 px-3">
              <DatasetFilterRow
                label="Ranking"
                definition="Choose whether countries are ranked by unique UUPGs or by the summed population of UUPG rows."
              >
                <ButtonGroup
                  aria-label="Hotspots ranking metric"
                  className="w-full rounded-xl border border-border/70 bg-background/80 p-0.5 shadow-xs shadow-black/5"
                >
                  {([
                    {
                      label: "Unique UUPGs",
                      value: "unique_uupgs",
                    },
                    {
                      label: "UUPG population",
                      value: "population",
                    },
                  ] as const).map((option) => {
                    const isActive = hotspotsCard.metric === option.value;

                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hotspotsCard.enabled}
                        aria-pressed={isActive}
                        aria-label={`Set Hotspots ranking to ${option.label}`}
                        className={cn(
                          "min-w-0 flex-1 rounded-lg border-0 px-2.5 text-[0.72rem] font-semibold tracking-[0.02em] shadow-none",
                          isActive
                            ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                        )}
                        onClick={() => hotspotsCard.onMetricChange(option.value)}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </ButtonGroup>
              </DatasetFilterRow>
              <DatasetFilterRow
                label="# of countries"
                definition="Keep only UUPG rows from the top N primary countries for the selected Hotspots ranking."
                controlClassName="max-w-[10rem]"
              >
                <DatasetFilterNumberControl
                  label="Hotspots country count"
                  value={hotspotsCard.countryCount}
                  min={hotspotsCard.minCountryCount}
                  max={hotspotsCard.maxCountryCount}
                  operator="<="
                  disabled={!hotspotsCard.enabled}
                  onValueChange={hotspotsCard.onCountryCountChange}
                />
              </DatasetFilterRow>
            </div>
          )}
        </FilterSection>
      </div>
    </div>
  );
}

const MemoizedDatasetViewSwitchGrid = memo(DatasetViewSwitchGridInner);

MemoizedDatasetViewSwitchGrid.displayName = "DatasetViewSwitchGrid";

const DatasetViewSwitchGrid =
  MemoizedDatasetViewSwitchGrid as typeof DatasetViewSwitchGridInner;

export { DatasetViewSwitchGrid };
