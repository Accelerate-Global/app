import { createHash } from "node:crypto";
import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import { filterRegionCountries, filterRegions } from "@/db/schema";

export type PrivateDataChatFilterRegionRow = Readonly<{
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  updatedAt: Date;
}>;

export type PrivateDataChatFilterRegionCountryRow = Readonly<{
  regionId: string;
  countryName: string;
}>;

export type PrivateDataChatFilterRegionSource = Readonly<{
  checksum: string;
  regions: readonly Readonly<{
    id: string;
    name: string;
    description: string;
    sortOrder: number;
    updatedAt: string;
    countries: readonly string[];
  }>[];
}>;

function canonicalRows(input: {
  regions: readonly PrivateDataChatFilterRegionRow[];
  countries: readonly PrivateDataChatFilterRegionCountryRow[];
}) {
  return {
    regions: [...input.regions]
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id),
      )
      .map((region) => ({
        id: region.id,
        name: region.name,
        description: region.description,
        sortOrder: region.sortOrder,
        updatedAt: region.updatedAt.toISOString(),
      })),
    countries: [...input.countries]
      .sort(
        (left, right) =>
          left.regionId.localeCompare(right.regionId) ||
          left.countryName.localeCompare(right.countryName),
      )
      .map((country) => ({
        regionId: country.regionId,
        countryName: country.countryName,
      })),
  };
}

export function calculatePrivateDataChatFilterRegionSourceChecksum(input: {
  regions: readonly PrivateDataChatFilterRegionRow[];
  countries: readonly PrivateDataChatFilterRegionCountryRow[];
}) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalRows(input)))
    .digest("hex");
}

export function buildPrivateDataChatFilterRegionSource(input: {
  regions: readonly PrivateDataChatFilterRegionRow[];
  countries: readonly PrivateDataChatFilterRegionCountryRow[];
}): PrivateDataChatFilterRegionSource {
  const canonical = canonicalRows(input);
  const countriesByRegion = new Map<string, string[]>();
  for (const country of canonical.countries) {
    const countries = countriesByRegion.get(country.regionId) ?? [];
    countries.push(country.countryName);
    countriesByRegion.set(country.regionId, countries);
  }
  return {
    checksum: createHash("sha256")
      .update(JSON.stringify(canonical))
      .digest("hex"),
    regions: canonical.regions.map((region) => ({
      ...region,
      countries: countriesByRegion.get(region.id) ?? [],
    })),
  };
}

export async function loadPrivateDataChatFilterRegionSource() {
  const [regions, countries] = await Promise.all([
    getDb()
      .select({
        id: filterRegions.id,
        name: filterRegions.name,
        description: filterRegions.description,
        sortOrder: filterRegions.sortOrder,
        updatedAt: filterRegions.updatedAt,
      })
      .from(filterRegions)
      .orderBy(
        asc(filterRegions.sortOrder),
        asc(filterRegions.name),
        asc(filterRegions.id),
      ),
    getDb()
      .select({
        regionId: filterRegionCountries.regionId,
        countryName: filterRegionCountries.countryName,
      })
      .from(filterRegionCountries)
      .orderBy(
        asc(filterRegionCountries.regionId),
        asc(filterRegionCountries.countryName),
      ),
  ]);
  return buildPrivateDataChatFilterRegionSource({ regions, countries });
}
