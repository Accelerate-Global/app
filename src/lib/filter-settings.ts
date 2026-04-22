import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { filterRegionCountries, filterRegions } from "@/db/schema";
import type { FilterRegion } from "@/lib/api-types";

function toFilterRegion(input: {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  countries: string[];
  createdAt: Date;
  updatedAt: Date;
}): FilterRegion {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    sortOrder: input.sortOrder,
    countries: [...input.countries].sort((left, right) =>
      left.localeCompare(right),
    ),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}

export async function listFilterRegions() {
  const rows = await getDb()
    .select({
      id: filterRegions.id,
      name: filterRegions.name,
      description: filterRegions.description,
      sortOrder: filterRegions.sortOrder,
      createdAt: filterRegions.createdAt,
      updatedAt: filterRegions.updatedAt,
      countryName: filterRegionCountries.countryName,
    })
    .from(filterRegions)
    .leftJoin(
      filterRegionCountries,
      eq(filterRegionCountries.regionId, filterRegions.id),
    )
    .orderBy(
      asc(filterRegions.sortOrder),
      asc(filterRegions.name),
      asc(filterRegionCountries.countryName),
    );

  const regions = new Map<
    string,
    {
      id: string;
      name: string;
      description: string;
      sortOrder: number;
      countries: string[];
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  for (const row of rows) {
    const existing =
      regions.get(row.id) ??
      {
        id: row.id,
        name: row.name,
        description: row.description,
        sortOrder: row.sortOrder,
        countries: [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

    if (row.countryName) {
      existing.countries.push(row.countryName);
    }

    regions.set(row.id, existing);
  }

  return Array.from(regions.values()).map(toFilterRegion);
}
