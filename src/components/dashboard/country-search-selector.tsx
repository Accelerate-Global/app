"use client";

import { SearchIcon } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CountrySearchSelectorProps = {
  allCountries: string[];
  selectedCountries: string[];
  visibleCountries?: string[];
  searchValue: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onToggleCountry: (country: string, checked: boolean) => void;
  onSelectVisible: (countries: string[]) => void;
  onClearVisible: (countries: string[]) => void;
  smokeSearchMarker?: string;
};

export function CountrySearchSelector({
  allCountries,
  selectedCountries,
  visibleCountries,
  searchValue,
  disabled,
  onSearchChange,
  onToggleCountry,
  onSelectVisible,
  onClearVisible,
  smokeSearchMarker,
}: CountrySearchSelectorProps) {
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredCountries = useMemo(
    () =>
      normalizedSearch
        ? allCountries.filter((country) =>
            country.toLowerCase().includes(normalizedSearch),
          )
        : allCountries,
    [allCountries, normalizedSearch],
  );
  const selectedSet = useMemo(
    () => new Set(selectedCountries),
    [selectedCountries],
  );
  const selectionSummary =
    selectedCountries.length > 0
      ? `${selectedCountries.length} selected`
      : visibleCountries && visibleCountries.length > 0
        ? `${visibleCountries.length} visible`
        : "0 selected";

  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-border/70 bg-card/45 shadow-xs shadow-black/5">
      <div className="space-y-3 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.14em] uppercase"
          >
            {selectionSummary}
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="rounded-full px-3"
              disabled={disabled || filteredCountries.length === 0}
              onClick={() => onSelectVisible(filteredCountries)}
            >
              Select visible
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="rounded-full px-3"
              disabled={disabled || filteredCountries.length === 0}
              onClick={() => onClearVisible(filteredCountries)}
            >
              Clear visible
            </Button>
          </div>
        </div>

        <div className="relative min-w-0">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchValue}
            disabled={disabled}
            placeholder="Type a country name"
            aria-label="Search countries"
            className="h-9 rounded-xl border-border/70 bg-background/80 pl-9 shadow-xs shadow-black/5"
            data-smoke-region-country-search={smokeSearchMarker}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className="border-t border-border/70 bg-background/35">
        {filteredCountries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No countries match this search.
          </div>
        ) : (
          <div className="max-h-64 divide-y divide-border/70 overflow-y-auto">
            {filteredCountries.map((country) => (
              <label
                key={country}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-accent/10",
                  selectedSet.has(country) ? "bg-accent/5" : "",
                )}
                {...(smokeSearchMarker
                  ? {
                      "data-smoke-region-country-option": `${smokeSearchMarker}:${country}`,
                    }
                  : {})}
              >
                <Checkbox
                  checked={selectedSet.has(country)}
                  disabled={disabled}
                  className="mt-0.5"
                  onCheckedChange={(checked) => onToggleCountry(country, !!checked)}
                  aria-label={`Include ${country}`}
                />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {country}
                  </span>
                  {selectedSet.has(country) ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      Selected
                    </span>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
