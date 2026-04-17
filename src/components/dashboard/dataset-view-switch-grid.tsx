"use client";

import { InfoIcon, MapIcon, MicroscopeIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";

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
import { cn } from "@/lib/utils";

type RegionSelector = {
  id: string;
  label: string;
  checked: boolean;
  description: string;
  countries: string[];
};

type DatasetViewSwitchGridProps = {
  regionCard: {
    enabled: boolean;
    supported: boolean;
    selectors: RegionSelector[];
    onSelectorChange: (regionId: string, checked: boolean) => void;
  };
  watchlistCard: {
    enabled: boolean;
    supported: boolean;
    thresholdLabel: string;
    thresholdDefinition: string;
    threshold: number;
    minThreshold: number;
    maxThreshold: number;
    frontierGroupLabel: string;
    frontierGroupDefinition: string;
    frontierGroupValue: boolean;
    onEnabledChange: (checked: boolean) => void;
    onThresholdChange: (value: number) => void;
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
const INFO_TOOLTIP_CONTENT_CLASSNAME =
  "max-w-[26rem] rounded-2xl border border-border/80 bg-popover px-4 py-3.5 text-sm leading-6 text-popover-foreground shadow-lg ring-1 ring-foreground/8";

function DatasetViewCard({
  title,
  description,
  icon,
  enabled,
  disabled = false,
  children,
  onEnabledChange,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onEnabledChange?: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[14rem] flex-col overflow-hidden rounded-[1.25rem] border border-border/80 bg-card/95 p-4 shadow-sm transition-colors",
        enabled ? "border-foreground/15 bg-accent/10" : "hover:bg-accent/10",
        disabled ? "opacity-75" : "",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-xs shadow-black/5">
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </h2>
            <p className="text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        {onEnabledChange ? (
          <Switch
            size="sm"
            checked={enabled}
            disabled={disabled}
            onCheckedChange={onEnabledChange}
            aria-label={`Toggle ${title}`}
          />
        ) : null}
      </div>
      <div className="mt-4 flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

function RegionCountriesInfo({
  label,
  description,
  countries,
}: {
  label: string;
  description: string;
  countries: string[];
}) {
  const tooltipText = getRegionTooltipText(label, description, countries);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`View countries in ${label}`}
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
            {label}
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
    return trimmedDescription;
  }

  if (label.trim().toLowerCase() === "globe") {
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
      <TooltipContent
        sideOffset={8}
        className={INFO_TOOLTIP_CONTENT_CLASSNAME}
      >
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

function WatchlistExpressionLabel({
  label,
  definition,
  operator,
}: {
  label: string;
  definition: string;
  operator: "<=" | "=";
}) {
  return (
    <div className="min-w-0 flex items-center gap-1.5">
      <div className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 shadow-xs shadow-black/5">
        <span className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
          {label}
        </span>
        <span className="shrink-0 text-sm font-semibold tracking-[-0.02em] text-foreground/70">
          {operator}
        </span>
      </div>
      <FieldDefinitionInfo label={label} definition={definition} />
    </div>
  );
}

export function DatasetViewSwitchGrid({
  regionCard,
  watchlistCard,
  uupgCard,
}: DatasetViewSwitchGridProps) {
  const hasRegions = regionCard.selectors.length > 0;
  const regionCardDisabled = !regionCard.supported || !hasRegions;
  const watchlistCardDisabled = !watchlistCard.supported;
  const uupgCardDisabled = !uupgCard.supported;

  return (
    <div className="grid w-full auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DatasetViewCard
        title="Region"
        description="A grouping of people groups based on geography."
        icon={<MapIcon aria-hidden="true" className="size-5" />}
        enabled={regionCard.enabled}
        disabled={regionCardDisabled}
      >
        {!regionCard.supported ? (
          <div className="self-end text-sm leading-5 text-muted-foreground">
            This dataset does not include <code>Geo_Country_Name</code>, so region filtering is unavailable.
          </div>
        ) : !hasRegions ? (
          <div className="self-end text-sm leading-5 text-muted-foreground">
            No regions have been configured yet.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-border/70">
              {regionCard.selectors.map((selector) => (
                <div
                  key={selector.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {selector.label}
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
                    aria-label={`Toggle ${selector.label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </DatasetViewCard>

      <DatasetViewCard
        title="Watchlist"
        description="People groups unengaged or would be unengaged if the current mission work stopped today."
        icon={<MicroscopeIcon aria-hidden="true" className="size-5" />}
        enabled={watchlistCard.enabled}
        disabled={watchlistCardDisabled}
        onEnabledChange={watchlistCard.onEnabledChange}
      >
        {!watchlistCard.supported ? (
          <div className="self-end text-sm leading-5 text-muted-foreground">
            This dataset does not include <code>{watchlistCard.thresholdLabel}</code>{" "}
            and <code>{watchlistCard.frontierGroupLabel}</code>, so Watchlist
            filtering is unavailable.
          </div>
        ) : (
          <div className="mt-auto w-full self-end">
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-2.5 text-sm">
                <WatchlistExpressionLabel
                  label={watchlistCard.thresholdLabel}
                  definition={watchlistCard.thresholdDefinition}
                  operator="<="
                />
                <NumberField
                  value={watchlistCard.threshold}
                  min={watchlistCard.minThreshold}
                  max={watchlistCard.maxThreshold}
                  step={1}
                  smallStep={1}
                  largeStep={1}
                  snapOnStep
                  disabled={!watchlistCard.enabled}
                  onValueChange={(value) =>
                    watchlistCard.onThresholdChange(value ?? watchlistCard.minThreshold)
                  }
                  className="min-w-[8.75rem]"
                >
                  <NumberFieldGroup className="h-10 rounded-xl border-border/70 bg-background/80 text-foreground shadow-xs shadow-black/5 focus-within:border-foreground/20 focus-within:ring-foreground/10">
                    <NumberFieldInput
                      className="px-3 text-left text-sm font-semibold tracking-[-0.02em] text-foreground"
                      aria-label={`Watchlist ${watchlistCard.thresholdLabel} threshold`}
                    />
                    <NumberFieldDecrement
                      className="rounded-none! border-l border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      aria-label={`Decrease ${watchlistCard.thresholdLabel} threshold`}
                    />
                    <NumberFieldIncrement
                      className="border-l border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      aria-label={`Increase ${watchlistCard.thresholdLabel} threshold`}
                    />
                  </NumberFieldGroup>
                </NumberField>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm">
                <WatchlistExpressionLabel
                  label={watchlistCard.frontierGroupLabel}
                  definition={watchlistCard.frontierGroupDefinition}
                  operator="="
                />
                <ButtonGroup
                  aria-label={`Watchlist ${watchlistCard.frontierGroupLabel} value`}
                  className="rounded-xl border border-border/70 bg-background/80 p-1 shadow-xs shadow-black/5"
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
                        disabled={!watchlistCard.enabled}
                        aria-pressed={isActive}
                        aria-label={`Set Watchlist ${watchlistCard.frontierGroupLabel} value to ${option.label}`}
                        className={cn(
                          "min-w-[4.75rem] border-0 px-3 text-[0.8rem] font-semibold tracking-[0.08em] uppercase shadow-none",
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
              </div>
            </div>
          </div>
        )}
      </DatasetViewCard>

      <DatasetViewCard
        title="UUPG"
        description="People groups who have no record of engagement among them."
        icon={<UserRoundIcon aria-hidden="true" className="size-5" />}
        enabled={uupgCard.enabled}
        disabled={uupgCardDisabled}
      >
        {!uupgCard.supported ? (
          <div className="self-end text-sm leading-5 text-muted-foreground">
            This dataset does not include <code>{uupgCard.fieldLabel}</code>, so UUPG
            filtering is unavailable.
          </div>
        ) : (
          <div className="mt-auto w-full self-end">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <code className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                    {uupgCard.fieldLabel}
                  </code>
                  <FieldDefinitionInfo
                    label={uupgCard.fieldLabel}
                    definition={uupgCard.fieldDefinition}
                  />
                </div>
              </div>
              <Switch
                size="sm"
                checked={uupgCard.enabled}
                disabled={uupgCardDisabled}
                onCheckedChange={uupgCard.onEnabledChange}
                aria-label={`Toggle ${uupgCard.fieldLabel}`}
              />
            </div>
          </div>
        )}
      </DatasetViewCard>
    </div>
  );
}
