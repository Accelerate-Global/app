"use client";

import { SearchIcon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type CountrySearchSelectorProps = {
  allCountries: string[];
  selectedCountries: string[];
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
  searchValue,
  disabled,
  onSearchChange,
  onToggleCountry,
  onSelectVisible,
  onClearVisible,
  smokeSearchMarker,
}: CountrySearchSelectorProps) {
  const normalizedSearch = searchValue.trim().toLowerCase();
  const visibleCountries = useMemo(
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

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            disabled={disabled}
            placeholder="Search countries"
            className="pl-9"
            data-smoke-region-country-search={smokeSearchMarker}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{selectedCountries.length} selected</span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={disabled || visibleCountries.length === 0}
            onClick={() => onSelectVisible(visibleCountries)}
          >
            Select visible
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={disabled || visibleCountries.length === 0}
            onClick={() => onClearVisible(visibleCountries)}
          >
            Clear visible
          </Button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background">
        {visibleCountries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No countries match this search.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleCountries.map((country) => (
              <label
                key={country}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/10"
                {...(smokeSearchMarker
                  ? {
                      "data-smoke-region-country-option": `${smokeSearchMarker}:${country}`,
                    }
                  : {})}
              >
                <Checkbox
                  checked={selectedSet.has(country)}
                  disabled={disabled}
                  onCheckedChange={(checked) => onToggleCountry(country, !!checked)}
                  aria-label={`Include ${country}`}
                />
                <span className="min-w-0 flex-1 truncate">{country}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
