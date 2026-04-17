"use client";

import { Loader2Icon, MapIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { CountrySearchSelector } from "@/components/dashboard/country-search-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  FilterRegion,
  FilterRegionResponse,
} from "@/lib/api-types";
import { normalizeRegionDisplayName } from "@/lib/region-display";

type FilterSettingsClientProps = {
  initialRegions: FilterRegion[];
  countryOptions: string[];
};

type RegionMutationInput = {
  name: string;
  description: string;
  sortOrder: number;
  countries: string[];
};

function sortRegions(regions: FilterRegion[]) {
  return [...regions].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function getNextSortOrder(regions: FilterRegion[]) {
  if (regions.length === 0) {
    return 1;
  }

  return Math.max(...regions.map((region) => region.sortOrder)) + 1;
}

function parseSortOrder(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  const [description, setDescription] = useState(region.description);
  const [sortOrder, setSortOrder] = useState(String(region.sortOrder));
  const [selectedCountries, setSelectedCountries] = useState(region.countries);
  const [searchValue, setSearchValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const parsedSortOrder = parseSortOrder(sortOrder);
  const canSave =
    !isSaving &&
    !isDeleting &&
    Boolean(trimmedName) &&
    parsedSortOrder !== null &&
    selectedCountries.length > 0 &&
    (trimmedName !== region.name ||
      trimmedDescription !== region.description ||
      parsedSortOrder !== region.sortOrder ||
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

    if (parsedSortOrder === null) {
      setErrorMessage("Enter a card order greater than zero.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSave(region.id, {
        name: trimmedName,
        description: trimmedDescription,
        sortOrder: parsedSortOrder,
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
    if (
      !window.confirm(
        `Delete the region "${normalizeRegionDisplayName(region.name)}"?`,
      )
    ) {
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
    <Card data-smoke-region-card={region.name}>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">
          {normalizeRegionDisplayName(region.name)}
        </CardTitle>
        <CardDescription>
          Define this region&apos;s tooltip copy, display order, and country membership on dataset pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Region update failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor={`region-name-${region.id}`}>
              Region name
            </label>
            <Input
              id={`region-name-${region.id}`}
              value={name}
              disabled={isSaving || isDeleting}
              data-smoke-region-name={region.id}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor={`region-order-${region.id}`}>
              Card order
            </label>
            <Input
              id={`region-order-${region.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={sortOrder}
              disabled={isSaving || isDeleting}
              onChange={(event) => setSortOrder(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Smaller numbers appear first.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor={`region-description-${region.id}`}>
            Tooltip description
          </label>
          <textarea
            id={`region-description-${region.id}`}
            value={description}
            disabled={isSaving || isDeleting}
            data-smoke-region-description={region.id}
            placeholder="Leave blank to show the region's country list."
            className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80"
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the country list as the default tooltip content.
          </p>
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Countries</p>
            <p className="text-sm text-muted-foreground">
              These values map directly to <code>Geo_Country_Name</code>.
            </p>
          </div>

          <CountrySearchSelector
            allCountries={countryOptions}
            selectedCountries={selectedCountries}
            searchValue={searchValue}
            disabled={isSaving || isDeleting}
            onSearchChange={setSearchValue}
            onToggleCountry={setCountrySelection}
            onSelectVisible={selectVisibleCountries}
            onClearVisible={clearVisibleCountries}
            smokeSearchMarker={region.id}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!canSave}
            data-smoke-region-save={region.id}
            onClick={handleSave}
          >
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
  const [newDescription, setNewDescription] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(() =>
    String(getNextSortOrder(initialRegions)),
  );
  const [newSelectedCountries, setNewSelectedCountries] = useState<string[]>([]);
  const [newSearchValue, setNewSearchValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const parsedNewSortOrder = parseSortOrder(newSortOrder);

  const canCreate =
    !isCreating &&
    Boolean(newName.trim()) &&
    parsedNewSortOrder !== null &&
    newSelectedCountries.length > 0;

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

    if (parsedNewSortOrder === null) {
      setCreateError("Enter a card order greater than zero.");
      return;
    }

    setCreateError(null);
    setCreateSuccess(null);
    setIsCreating(true);

    try {
      const region = await createRegion({
        name: newName.trim(),
        description: newDescription.trim(),
        sortOrder: parsedNewSortOrder,
        countries: newSelectedCountries,
      });

      const nextRegions = sortRegions([...regions, region]);
      setRegions(nextRegions);
      setNewName("");
      setNewDescription("");
      setNewSortOrder(String(getNextSortOrder(nextRegions)));
      setNewSelectedCountries([]);
      setNewSearchValue("");
      setCreateSuccess(`Created ${normalizeRegionDisplayName(region.name)}.`);
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

    setRegions((current) => {
      const nextRegions = sortRegions(
        current.map((region) =>
          region.id === updatedRegion.id ? updatedRegion : region,
        ),
      );
      setNewSortOrder(String(getNextSortOrder(nextRegions)));
      return nextRegions;
    });
  }

  async function handleDeleteRegion(regionId: string) {
    await removeRegion(regionId);
    setRegions((current) => {
      const nextRegions = current.filter((region) => region.id !== regionId);
      setNewSortOrder(String(getNextSortOrder(nextRegions)));
      return nextRegions;
    });
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
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-region-name">
                  Region name
                </label>
                <Input
                  id="new-region-name"
                  value={newName}
                  disabled={isCreating}
                  placeholder="South Asia"
                  data-smoke-region-create-name
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-region-order">
                  Card order
                </label>
                <Input
                  id="new-region-order"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={newSortOrder}
                  disabled={isCreating}
                  data-smoke-region-create-sort-order
                  onChange={(event) => setNewSortOrder(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Smaller numbers appear first.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="new-region-description">
              Tooltip description
            </label>
            <textarea
              id="new-region-description"
              value={newDescription}
              disabled={isCreating}
              placeholder="Leave blank to show the region's country list."
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80"
              onChange={(event) => setNewDescription(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the country list as the default tooltip content.
            </p>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Countries</p>
              <p className="text-sm text-muted-foreground">
                Choose from the shared country master list used to build Region selectors across dataset pages.
              </p>
            </div>
            <CountrySearchSelector
              allCountries={countryOptions}
              selectedCountries={newSelectedCountries}
              searchValue={newSearchValue}
              disabled={isCreating}
              onSearchChange={setNewSearchValue}
              onToggleCountry={setNewCountrySelection}
              onSelectVisible={selectVisibleCountries}
              onClearVisible={clearVisibleCountries}
              smokeSearchMarker="create"
            />
          </div>

          <Button
            type="button"
            disabled={!canCreate}
            data-smoke-region-create-submit
            onClick={handleCreateRegion}
          >
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
