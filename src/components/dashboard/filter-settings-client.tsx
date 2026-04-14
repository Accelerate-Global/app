"use client";

import { Loader2Icon, MapIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  FilterRegion,
  FilterRegionResponse,
} from "@/lib/api-types";

type FilterSettingsClientProps = {
  initialRegions: FilterRegion[];
  countryOptions: string[];
};

type RegionMutationInput = {
  name: string;
  countries: string[];
};

function sortRegions(regions: FilterRegion[]) {
  return [...regions].sort((left, right) => left.name.localeCompare(right.name));
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function createRegion(input: RegionMutationInput) {
  const response = await fetch("/api/filter-settings/regions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The region could not be created."));
  }

  return ((await response.json()) as FilterRegionResponse).region;
}

async function updateRegion(regionId: string, input: RegionMutationInput) {
  const response = await fetch(`/api/filter-settings/regions/${regionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The region could not be updated."));
  }

  return ((await response.json()) as FilterRegionResponse).region;
}

async function removeRegion(regionId: string) {
  const response = await fetch(`/api/filter-settings/regions/${regionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The region could not be deleted."));
  }
}

function CountrySelector({
  allCountries,
  selectedCountries,
  searchValue,
  disabled,
  onSearchChange,
  onToggleCountry,
  onSelectVisible,
  onClearVisible,
}: {
  allCountries: string[];
  selectedCountries: string[];
  searchValue: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onToggleCountry: (country: string, checked: boolean) => void;
  onSelectVisible: (countries: string[]) => void;
  onClearVisible: (countries: string[]) => void;
}) {
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

function RegionEditorCard({
  region,
  countryOptions,
  onSave,
  onDelete,
}: {
  region: FilterRegion;
  countryOptions: string[];
  onSave: (regionId: string, input: RegionMutationInput) => Promise<void>;
  onDelete: (regionId: string) => Promise<void>;
}) {
  const [name, setName] = useState(region.name);
  const [selectedCountries, setSelectedCountries] = useState(region.countries);
  const [searchValue, setSearchValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const trimmedName = name.trim();
  const canSave =
    !isSaving &&
    !isDeleting &&
    Boolean(trimmedName) &&
    selectedCountries.length > 0 &&
    (trimmedName !== region.name ||
      JSON.stringify(selectedCountries) !== JSON.stringify(region.countries));

  function setCountrySelection(country: string, checked: boolean) {
    setSelectedCountries((current) => {
      if (checked) {
        if (current.includes(country)) {
          return current;
        }

        return [...current, country].sort((left, right) => left.localeCompare(right));
      }

      return current.filter((value) => value !== country);
    });
  }

  function selectVisibleCountries(countries: string[]) {
    setSelectedCountries((current) =>
      Array.from(new Set([...current, ...countries])).sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  }

  function clearVisibleCountries(countries: string[]) {
    const countriesToClear = new Set(countries);
    setSelectedCountries((current) =>
      current.filter((country) => !countriesToClear.has(country)),
    );
  }

  async function handleSave() {
    if (!trimmedName) {
      setErrorMessage("Enter a region name.");
      return;
    }

    if (selectedCountries.length === 0) {
      setErrorMessage("Select at least one country.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave(region.id, {
        name: trimmedName,
        countries: selectedCountries,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The region could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the region "${region.name}"?`)) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await onDelete(region.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The region could not be deleted.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{region.name}</CardTitle>
        <CardDescription>
          Define which countries belong to this region on dataset pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Region update failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor={`region-name-${region.id}`}>
            Region name
          </label>
          <Input
            id={`region-name-${region.id}`}
            value={name}
            disabled={isSaving || isDeleting}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Countries</p>
            <p className="text-sm text-muted-foreground">
              These values map directly to <code>Geo_Country_Name</code>.
            </p>
          </div>

          <CountrySelector
            allCountries={countryOptions}
            selectedCountries={selectedCountries}
            searchValue={searchValue}
            disabled={isSaving || isDeleting}
            onSearchChange={setSearchValue}
            onToggleCountry={setCountrySelection}
            onSelectVisible={selectVisibleCountries}
            onClearVisible={clearVisibleCountries}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {isSaving ? <Loader2Icon className="animate-spin" /> : null}
            Save region
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSaving || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Delete region
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FilterSettingsClient({
  initialRegions,
  countryOptions,
}: FilterSettingsClientProps) {
  const [regions, setRegions] = useState(() => sortRegions(initialRegions));
  const [newName, setNewName] = useState("");
  const [newSelectedCountries, setNewSelectedCountries] = useState<string[]>([]);
  const [newSearchValue, setNewSearchValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const canCreate =
    !isCreating && Boolean(newName.trim()) && newSelectedCountries.length > 0;

  function setNewCountrySelection(country: string, checked: boolean) {
    setNewSelectedCountries((current) => {
      if (checked) {
        if (current.includes(country)) {
          return current;
        }

        return [...current, country].sort((left, right) => left.localeCompare(right));
      }

      return current.filter((value) => value !== country);
    });
  }

  function selectVisibleCountries(countries: string[]) {
    setNewSelectedCountries((current) =>
      Array.from(new Set([...current, ...countries])).sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  }

  function clearVisibleCountries(countries: string[]) {
    const countriesToClear = new Set(countries);
    setNewSelectedCountries((current) =>
      current.filter((country) => !countriesToClear.has(country)),
    );
  }

  async function handleCreateRegion() {
    if (!newName.trim()) {
      setCreateError("Enter a region name.");
      return;
    }

    if (newSelectedCountries.length === 0) {
      setCreateError("Select at least one country.");
      return;
    }

    setCreateError(null);
    setCreateSuccess(null);
    setIsCreating(true);

    try {
      const region = await createRegion({
        name: newName.trim(),
        countries: newSelectedCountries,
      });

      setRegions((current) => sortRegions([...current, region]));
      setNewName("");
      setNewSelectedCountries([]);
      setNewSearchValue("");
      setCreateSuccess(`Created ${region.name}.`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "The region could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveRegion(regionId: string, input: RegionMutationInput) {
    const updatedRegion = await updateRegion(regionId, input);

    setRegions((current) =>
      sortRegions(
        current.map((region) =>
          region.id === updatedRegion.id ? updatedRegion : region,
        ),
      ),
    );
  }

  async function handleDeleteRegion(regionId: string) {
    await removeRegion(regionId);
    setRegions((current) => current.filter((region) => region.id !== regionId));
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MapIcon className="size-5 text-muted-foreground" />
            Region
          </CardTitle>
          <CardDescription>
            Create the shared region selectors that appear on every dataset page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createError ? (
            <Alert variant="destructive">
              <AlertTitle>Region creation failed</AlertTitle>
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          ) : null}
          {createSuccess ? (
            <Alert>
              <AlertTitle>Region created</AlertTitle>
              <AlertDescription>{createSuccess}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="new-region-name">
              Region name
            </label>
            <Input
              id="new-region-name"
              value={newName}
              disabled={isCreating}
              placeholder="South Asia"
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Countries</p>
              <p className="text-sm text-muted-foreground">
                Choose from the shared country master list used to build Region selectors across dataset pages.
              </p>
            </div>
            <CountrySelector
              allCountries={countryOptions}
              selectedCountries={newSelectedCountries}
              searchValue={newSearchValue}
              disabled={isCreating}
              onSearchChange={setNewSearchValue}
              onToggleCountry={setNewCountrySelection}
              onSelectVisible={selectVisibleCountries}
              onClearVisible={clearVisibleCountries}
            />
          </div>

          <Button type="button" disabled={!canCreate} onClick={handleCreateRegion}>
            {isCreating ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Create region
          </Button>
        </CardContent>
      </Card>

      {regions.length === 0 ? (
        <Alert>
          <AlertTitle>No regions configured yet</AlertTitle>
          <AlertDescription>
            Create your first region to make the Region card filter live on dataset pages.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6">
          {regions.map((region) => (
            <RegionEditorCard
              key={`${region.id}:${region.updatedAt}`}
              region={region}
              countryOptions={countryOptions}
              onSave={handleSaveRegion}
              onDelete={handleDeleteRegion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
