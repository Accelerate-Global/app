"use client";

import { InfoIcon, MapIcon, MicroscopeIcon, UserRoundIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type RegionSelector = {
  id: string;
  label: string;
  checked: boolean;
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
    onEnabledChange: (checked: boolean) => void;
  };
  uupgCard: {
    enabled: boolean;
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
  countries,
}: {
  label: string;
  countries: string[];
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className="relative mt-1 inline-flex items-center">
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View countries in ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full left-0 z-10 mt-2 w-56 rounded-xl border border-border/80 bg-background/95 p-3 shadow-lg shadow-black/10 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {countries.map((country) => (
            <li key={country}>{country}</li>
          ))}
        </ul>
      </div>
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {selector.label}
                    </p>
                    <RegionCountriesInfo
                      label={selector.label}
                      countries={selector.countries}
                    />
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
        onEnabledChange={watchlistCard.onEnabledChange}
      />

      <DatasetViewCard
        title="UUPG"
        description="People groups who have no record of engagement among them."
        icon={<UserRoundIcon aria-hidden="true" className="size-5" />}
        enabled={uupgCard.enabled}
        onEnabledChange={uupgCard.onEnabledChange}
      />
    </div>
  );
}
