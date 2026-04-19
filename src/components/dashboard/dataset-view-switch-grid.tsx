"use client";

import {
  ChevronDownIcon,
  InfoIcon,
  MapIcon,
  MapPinnedIcon,
  MicroscopeIcon,
  UserRoundIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

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
import {
  isGlobeRegionName,
  normalizeRegionDisplayName,
  normalizeRegionDisplayText,
} from "@/lib/region-display";
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
    enabled: boolean;
    supported: boolean;
    selectors: RegionSelector[];
    onEnabledChange: (checked: boolean) => void;
    onSelectorChange: (regionId: string, checked: boolean) => void;
  };
  countryCard: {
    enabled: boolean;
    supported: boolean;
    searchValue: string;
    availableCountries: string[];
    selectedCountries: string[];
    onEnabledChange: (checked: boolean) => void;
    onSearchChange: (value: string) => void;
    onToggleCountry: (country: string, checked: boolean) => void;
    onSelectVisible: (countries: string[]) => void;
    onClearVisible: (countries: string[]) => void;
  };
  watchlistCard: {
    enabled: boolean;
    supported: boolean;
    thresholdLabel: string;
    thresholdDefinition: string;
    thresholdEnabled: boolean;
    threshold: number;
    minThreshold: number;
    maxThreshold: number;
    engagementPhaseLabel: string;
    engagementPhaseDefinition: string;
    engagementPhaseEnabled: boolean;
    engagementPhaseThreshold: number;
    minEngagementPhaseThreshold: number;
    maxEngagementPhaseThreshold: number;
    evangelicalBelieversLabel: string;
    evangelicalBelieversDefinition: string;
    evangelicalBelieversEnabled: boolean;
    evangelicalBelieversThreshold: number;
    minEvangelicalBelieversThreshold: number;
    maxEvangelicalBelieversThreshold: number;
    evangelicalPercentLabel: string;
    evangelicalPercentDefinition: string;
    evangelicalPercentEnabled: boolean;
    evangelicalPercentThreshold: number;
    minEvangelicalPercentThreshold: number;
    maxEvangelicalPercentThreshold: number;
    frontierGroupLabel: string;
    frontierGroupDefinition: string;
    frontierGroupEnabled: boolean;
    frontierGroupValue: boolean;
    onEnabledChange: (checked: boolean) => void;
    onThresholdEnabledChange: (checked: boolean) => void;
    onThresholdChange: (value: number) => void;
    onEngagementPhaseEnabledChange: (checked: boolean) => void;
    onEngagementPhaseThresholdChange: (value: number) => void;
    onEvangelicalBelieversEnabledChange: (checked: boolean) => void;
    onEvangelicalBelieversThresholdChange: (value: number) => void;
    onEvangelicalPercentEnabledChange: (checked: boolean) => void;
    onEvangelicalPercentThresholdChange: (value: number) => void;
    onFrontierGroupEnabledChange: (checked: boolean) => void;
    onFrontierGroupValueChange: (value: boolean) => void;
  };
  uupgCard: {
    enabled: boolean;
    supported: boolean;
    fieldLabel: string;
    fieldDefinition: string;
    onEnabledChange: (checked: boolean) => void;
  };
};

type FilterSectionId = "region" | "country" | "watchlist" | "uupg";

const FILTER_PANEL_DESCRIPTIONS = {
  region: "A grouping of people groups based on geography.",
  country:
    "Filter people groups by country, including matches found in alternate-country fields.",
  watchlist:
    "People groups unengaged or would be unengaged if the current mission work stopped today.",
  uupg: "People groups who have no record of engagement among them.",
} as const;

const INFO_TOOLTIP_CONTENT_CLASSNAME =
  "max-w-[26rem] rounded-2xl border border-border/80 bg-popover px-4 py-3.5 text-sm leading-6 text-popover-foreground shadow-lg ring-1 ring-foreground/8";

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

  if (isGlobeRegionName(label)) {
    return "All countries.";
  }

  return countries.join(", ");
}

function getVisibleRegionSelectors(
  regionCard: DatasetViewSwitchGridProps["regionCard"],
) {
  return regionCard.selectors.filter(
    (selector) => !isGlobeRegionName(selector.label),
  );
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

function WatchlistNumberControl({
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  operator: "<=" | ">=";
  disabled: boolean;
  onValueChange: (value: number) => void;
  step?: number;
  smallStep?: number;
  largeStep?: number;
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
      className="w-full sm:w-[10rem]"
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
          aria-label={`Decrease ${label} threshold`}
        />
        <NumberFieldInput
          className="border-r border-border/70 px-3 text-center text-sm font-semibold tracking-[-0.02em] text-foreground"
          aria-label={`Watchlist ${label} threshold`}
        />
        <NumberFieldIncrement
          className="rounded-none border-0 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          aria-label={`Increase ${label} threshold`}
        />
      </NumberFieldGroup>
    </NumberField>
  );
}

function FilterSection({
  id,
  title,
  icon,
  summary,
  description,
  expanded,
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
  toggleControl: ReactNode;
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
        <div className="shrink-0 pt-0.5">{toggleControl}</div>
      </div>
      {expanded ? (
        <div id={panelId} className="border-t border-border/70 px-3 pb-3 pt-3">
          <div className="space-y-3">
            <p className="text-sm leading-5 text-muted-foreground">{description}</p>
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

  const visibleSelectors = getVisibleRegionSelectors(regionCard);

  if (visibleSelectors.length === 0) {
    return ["No regions configured"];
  }

  if (!regionCard.enabled) {
    return ["Off"];
  }

  const selectedCount = visibleSelectors.filter((selector) => selector.checked).length;

  if (selectedCount === 0 || selectedCount === visibleSelectors.length) {
    return ["All regions"];
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
    summary.push(`${watchlistCard.thresholdLabel} <= ${watchlistCard.threshold}`);
  }

  if (watchlistCard.frontierGroupEnabled) {
    summary.push(
      `${watchlistCard.frontierGroupLabel}: ${
        watchlistCard.frontierGroupValue ? "True" : "False"
      }`,
    );
  }

  if (watchlistCard.evangelicalBelieversEnabled) {
    summary.push(
      `${watchlistCard.evangelicalBelieversLabel} <= ${watchlistCard.evangelicalBelieversThreshold}`,
    );
  }

  if (watchlistCard.evangelicalPercentEnabled) {
    summary.push(
      `${watchlistCard.evangelicalPercentLabel} >= ${watchlistCard.evangelicalPercentThreshold}`,
    );
  }

  if (watchlistCard.engagementPhaseEnabled) {
    summary.push(
      `${watchlistCard.engagementPhaseLabel} >= ${watchlistCard.engagementPhaseThreshold}`,
    );
  }

  return summary.length > 0 ? summary : ["No criteria selected"];
}

function getCountrySummary(countryCard: DatasetViewSwitchGridProps["countryCard"]) {
  if (!countryCard.supported) {
    return ["Unavailable"];
  }

  if (!countryCard.enabled) {
    return ["Off"];
  }

  if (countryCard.selectedCountries.length === 0) {
    return ["All countries"];
  }

  return [`${countryCard.selectedCountries.length} selected`];
}

function getUupgSummary(uupgCard: DatasetViewSwitchGridProps["uupgCard"]) {
  if (!uupgCard.supported) {
    return ["Unavailable"];
  }

  return [uupgCard.enabled ? "On" : "Off"];
}

export function DatasetViewSwitchGrid({
  className,
  regionCard,
  countryCard,
  watchlistCard,
  uupgCard,
}: DatasetViewSwitchGridProps) {
  const visibleRegionSelectors = getVisibleRegionSelectors(regionCard);
  const hasRegions = visibleRegionSelectors.length > 0;
  const [expandedSections, setExpandedSections] = useState<
    Record<FilterSectionId, boolean>
  >({
    region: false,
    country: false,
    watchlist: false,
    uupg: false,
  });
  const enableCountryFilter = () => {
    if (!countryCard.enabled) {
      countryCard.onEnabledChange(true);
    }
  };

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
          toggleControl={
            <Switch
              size="sm"
              checked={regionCard.enabled}
              disabled={!regionCard.supported || !hasRegions}
              onCheckedChange={regionCard.onEnabledChange}
              aria-label="Toggle Region"
            />
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
                      disabled={!regionCard.enabled}
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
          toggleControl={
            <Switch
              size="sm"
              checked={countryCard.enabled}
              disabled={!countryCard.supported}
              onCheckedChange={countryCard.onEnabledChange}
              aria-label="Toggle Country"
            />
          }
        >
          {!countryCard.supported ? (
            <p className="text-sm leading-5 text-muted-foreground">
              This dataset does not include <code>Geo_Country_Name</code>, so country
              filtering is unavailable.
            </p>
          ) : countryCard.availableCountries.length === 0 ? (
            <p className="text-sm leading-5 text-muted-foreground">
              No countries are available in this dataset.
            </p>
          ) : (
            <div className="px-3">
              <CountrySearchSelector
                allCountries={countryCard.availableCountries}
                selectedCountries={countryCard.selectedCountries}
                searchValue={countryCard.searchValue}
                disabled={false}
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
                onClearVisible={countryCard.onClearVisible}
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
                label={watchlistCard.thresholdLabel}
                definition={watchlistCard.thresholdDefinition}
                controlClassName="max-w-[10rem]"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.thresholdEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={watchlistCard.onThresholdEnabledChange}
                    aria-label={`Toggle Watchlist ${watchlistCard.thresholdLabel}`}
                  />
                }
              >
                <WatchlistNumberControl
                  label={watchlistCard.thresholdLabel}
                  value={watchlistCard.threshold}
                  min={watchlistCard.minThreshold}
                  max={watchlistCard.maxThreshold}
                  operator="<="
                  disabled={!watchlistCard.enabled || !watchlistCard.thresholdEnabled}
                  onValueChange={watchlistCard.onThresholdChange}
                />
              </DatasetFilterRow>
              <DatasetFilterRow
                label={watchlistCard.frontierGroupLabel}
                definition={watchlistCard.frontierGroupDefinition}
                controlClassName="max-w-[8.75rem]"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.frontierGroupEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={watchlistCard.onFrontierGroupEnabledChange}
                    aria-label={`Toggle Watchlist ${watchlistCard.frontierGroupLabel}`}
                  />
                }
              >
                <ButtonGroup
                  aria-label={`Watchlist ${watchlistCard.frontierGroupLabel} value`}
                  className="w-full rounded-xl border border-border/70 bg-background/80 p-0.5 shadow-xs shadow-black/5"
                >
                  {[
                    { label: "TRUE", value: true },
                    { label: "FALSE", value: false },
                  ].map((option) => {
                    const isActive =
                      watchlistCard.frontierGroupValue === option.value;

                    return (
                      <Button
                        key={option.label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          !watchlistCard.enabled || !watchlistCard.frontierGroupEnabled
                        }
                        aria-pressed={isActive}
                        aria-label={`Set Watchlist ${watchlistCard.frontierGroupLabel} value to ${option.label}`}
                        className={cn(
                          "min-w-0 flex-1 rounded-lg border-0 px-2.5 text-[0.72rem] font-semibold tracking-[0.08em] uppercase shadow-none",
                          isActive
                            ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                        )}
                        onClick={() =>
                          watchlistCard.onFrontierGroupValueChange(option.value)
                        }
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </ButtonGroup>
              </DatasetFilterRow>
              <DatasetFilterRow
                label={watchlistCard.evangelicalBelieversLabel}
                definition={watchlistCard.evangelicalBelieversDefinition}
                controlClassName="max-w-[10rem]"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.evangelicalBelieversEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={
                      watchlistCard.onEvangelicalBelieversEnabledChange
                    }
                    aria-label={`Toggle Watchlist ${watchlistCard.evangelicalBelieversLabel}`}
                  />
                }
              >
                <WatchlistNumberControl
                  label={watchlistCard.evangelicalBelieversLabel}
                  value={watchlistCard.evangelicalBelieversThreshold}
                  min={watchlistCard.minEvangelicalBelieversThreshold}
                  max={watchlistCard.maxEvangelicalBelieversThreshold}
                  operator="<="
                  disabled={
                    !watchlistCard.enabled ||
                    !watchlistCard.evangelicalBelieversEnabled
                  }
                  onValueChange={watchlistCard.onEvangelicalBelieversThresholdChange}
                />
              </DatasetFilterRow>
              <DatasetFilterRow
                label={watchlistCard.evangelicalPercentLabel}
                definition={watchlistCard.evangelicalPercentDefinition}
                controlClassName="max-w-[10rem]"
                toggleControl={
                  <Switch
                    size="sm"
                    checked={watchlistCard.evangelicalPercentEnabled}
                    disabled={!watchlistCard.enabled}
                    onCheckedChange={
                      watchlistCard.onEvangelicalPercentEnabledChange
                    }
                    aria-label={`Toggle Watchlist ${watchlistCard.evangelicalPercentLabel}`}
                  />
                }
              >
                <WatchlistNumberControl
                  label={watchlistCard.evangelicalPercentLabel}
                  value={watchlistCard.evangelicalPercentThreshold}
                  min={watchlistCard.minEvangelicalPercentThreshold}
                  max={watchlistCard.maxEvangelicalPercentThreshold}
                  operator=">="
                  disabled={
                    !watchlistCard.enabled || !watchlistCard.evangelicalPercentEnabled
                  }
                  onValueChange={watchlistCard.onEvangelicalPercentThresholdChange}
                  step={0.01}
                  smallStep={0.01}
                  largeStep={0.05}
                />
              </DatasetFilterRow>
              <DatasetFilterRow
                label={watchlistCard.engagementPhaseLabel}
                definition={watchlistCard.engagementPhaseDefinition}
                controlClassName="max-w-[10rem]"
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
                <WatchlistNumberControl
                  label={watchlistCard.engagementPhaseLabel}
                  value={watchlistCard.engagementPhaseThreshold}
                  min={watchlistCard.minEngagementPhaseThreshold}
                  max={watchlistCard.maxEngagementPhaseThreshold}
                  operator=">="
                  disabled={
                    !watchlistCard.enabled || !watchlistCard.engagementPhaseEnabled
                  }
                  onValueChange={watchlistCard.onEngagementPhaseThresholdChange}
                />
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
              This dataset does not include <code>{uupgCard.fieldLabel}</code>, so
              UUPG filtering is unavailable.
            </p>
          ) : (
            <div className="px-3">
              <DatasetFilterRow
                label={uupgCard.fieldLabel}
                definition={uupgCard.fieldDefinition}
              />
            </div>
          )}
        </FilterSection>
      </div>
    </div>
  );
}
