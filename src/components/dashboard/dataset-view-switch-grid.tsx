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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    onEnabledChange: (checked: boolean) => void;
    onSelectorChange: (regionId: string, checked: boolean) => void;
  };
  watchlistCard: {
    enabled: boolean;
    supported: boolean;
    threshold: number;
    minThreshold: number;
    maxThreshold: number;
    frontierGroupValue: boolean;
    onEnabledChange: (checked: boolean) => void;
    onThresholdChange: (value: number) => void;
    onFrontierGroupValueChange: (value: boolean) => void;
  };
  uupgCard: {
    enabled: boolean;
    supported: boolean;
    onEnabledChange: (checked: boolean) => void;
  };
};

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
  onEnabledChange: (checked: boolean) => void;
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
        <Switch
          size="sm"
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onEnabledChange}
          aria-label={`Toggle ${title}`}
        />
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
  const tooltipText = description.trim() || countries.join(", ");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`View countries in ${label}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-80 rounded-2xl px-3.5 py-2.5 text-sm leading-5"
      >
        <p className="text-left">
          <span className="font-medium">{label}:</span>{" "}
          <span className="whitespace-pre-line">{tooltipText}</span>
        </p>
      </TooltipContent>
    </Tooltip>
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
        onEnabledChange={regionCard.onEnabledChange}
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
            This dataset does not include <code>Christianity_GSEC</code> and{" "}
            <code>Christianity_Frontier_Group</code>, so Watchlist filtering is unavailable.
          </div>
        ) : (
          <div className="mt-auto w-full self-end">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <code className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  Christianity_GSEC
                </code>
                <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                  {"<="}
                </span>
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
                  className="w-28"
                >
                  <NumberFieldGroup>
                    <NumberFieldInput
                      className="text-left"
                      aria-label="Watchlist Christianity_GSEC threshold"
                    />
                    <NumberFieldDecrement
                      className="rounded-none!"
                      aria-label="Decrease Christianity_GSEC threshold"
                    />
                    <NumberFieldIncrement aria-label="Increase Christianity_GSEC threshold" />
                  </NumberFieldGroup>
                </NumberField>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <code className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  Christianity_Frontier_Group
                </code>
                <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                  =
                </span>
                <Select
                  value={watchlistCard.frontierGroupValue ? "true" : "false"}
                  disabled={!watchlistCard.enabled}
                  onValueChange={(value) =>
                    watchlistCard.onFrontierGroupValueChange(value === "true")
                  }
                >
                  <SelectTrigger
                    aria-label="Watchlist Christianity_Frontier_Group value"
                    className={cn(
                      "min-w-24 rounded-md border-0 px-2 py-1 text-xs font-medium uppercase",
                      watchlistCard.frontierGroupValue
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">TRUE</SelectItem>
                    <SelectItem value="false">FALSE</SelectItem>
                  </SelectContent>
                </Select>
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
        onEnabledChange={uupgCard.onEnabledChange}
      >
        {!uupgCard.supported ? (
          <div className="self-end text-sm leading-5 text-muted-foreground">
            This dataset does not include <code>Engage_Global_Engagement_Anywhere</code>, so UUPG filtering is unavailable.
          </div>
        ) : null}
      </DatasetViewCard>
    </div>
  );
}
