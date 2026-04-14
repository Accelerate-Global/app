import { and, asc, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { datasetRows, datasets, filterRegionCountries, filterRegions } from "@/db/schema";
import type { FilterRegion } from "@/lib/api-types";
import { REGION_DATASET_COLUMN_KEY } from "@/lib/dataset-region-constants";

function normalizeRegionName(name: string) {
  return name.trim();
}

function normalizeCountryName(country: string) {
  return country.trim();
}

function toFilterRegion(input: {
  id: string;
  name: string;
  countries: string[];
  createdAt: Date;
  updatedAt: Date;
}): FilterRegion {
  return {
    id: input.id,
    name: input.name,
    countries: [...input.countries].sort((left, right) =>
      left.localeCompare(right),
    ),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}

export class FilterRegionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterRegionConflictError";
  }
}

async function findExistingRegionByName(input: {
  name: string;
  excludeRegionId?: string;
}) {
  const predicates = [
    sql`lower(btrim(${filterRegions.name})) = lower(${normalizeRegionName(input.name)})`,
  ];

  if (input.excludeRegionId) {
    predicates.push(ne(filterRegions.id, input.excludeRegionId));
  }

  const [region] = await getDb()
    .select({ id: filterRegions.id })
    .from(filterRegions)
    .where(and(...predicates))
    .limit(1);

  return region ?? null;
}

export async function listFilterRegions() {
  const rows = await getDb()
    .select({
      id: filterRegions.id,
      name: filterRegions.name,
      createdAt: filterRegions.createdAt,
      updatedAt: filterRegions.updatedAt,
      countryName: filterRegionCountries.countryName,
    })
    .from(filterRegions)
    .leftJoin(
      filterRegionCountries,
      eq(filterRegionCountries.regionId, filterRegions.id),
    )
    .orderBy(asc(filterRegions.name), asc(filterRegionCountries.countryName));

  const regions = new Map<
    string,
    {
      id: string;
      name: string;
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

export async function createFilterRegion(input: {
  name: string;
  countries: string[];
}) {
  const normalizedName = normalizeRegionName(input.name);
  const normalizedCountries = input.countries.map(normalizeCountryName);

  const existingRegion = await findExistingRegionByName({ name: normalizedName });

  if (existingRegion) {
    throw new FilterRegionConflictError("A region with that name already exists.");
  }

  return getDb().transaction(async (tx) => {
    const [createdRegion] = await tx
      .insert(filterRegions)
      .values({
        name: normalizedName,
      })
      .returning();

    await tx.insert(filterRegionCountries).values(
      normalizedCountries.map((countryName) => ({
        regionId: createdRegion.id,
        countryName,
      })),
    );

    return toFilterRegion({
      id: createdRegion.id,
      name: createdRegion.name,
      countries: normalizedCountries,
      createdAt: createdRegion.createdAt,
      updatedAt: createdRegion.updatedAt,
    });
  });
}

export async function updateFilterRegion(input: {
  regionId: string;
  name: string;
  countries: string[];
}) {
  const normalizedName = normalizeRegionName(input.name);
  const normalizedCountries = input.countries.map(normalizeCountryName);
  const existingRegion = await findExistingRegionByName({
    name: normalizedName,
    excludeRegionId: input.regionId,
  });

  if (existingRegion) {
    throw new FilterRegionConflictError("A region with that name already exists.");
  }

  return getDb().transaction(async (tx) => {
    const [updatedRegion] = await tx
      .update(filterRegions)
      .set({
        name: normalizedName,
        updatedAt: new Date(),
      })
      .where(eq(filterRegions.id, input.regionId))
      .returning();

    if (!updatedRegion) {
      return null;
    }

    await tx
      .delete(filterRegionCountries)
      .where(eq(filterRegionCountries.regionId, input.regionId));

    await tx.insert(filterRegionCountries).values(
      normalizedCountries.map((countryName) => ({
        regionId: input.regionId,
        countryName,
      })),
    );

    return toFilterRegion({
      id: updatedRegion.id,
      name: updatedRegion.name,
      countries: normalizedCountries,
      createdAt: updatedRegion.createdAt,
      updatedAt: updatedRegion.updatedAt,
    });
  });
}

export async function deleteFilterRegion(regionId: string) {
  const [deletedRegion] = await getDb()
    .delete(filterRegions)
    .where(eq(filterRegions.id, regionId))
    .returning({ id: filterRegions.id });

  return deletedRegion ?? null;
}

export async function listRegionCountryOptions() {
  const geoCountryName = sql<string>`btrim(${datasetRows.data}->>${sql.raw(`'${REGION_DATASET_COLUMN_KEY}'`)})`;
  const rows = await getDb()
    .selectDistinct({
      countryName: geoCountryName,
    })
    .from(datasetRows)
    .innerJoin(datasets, eq(datasets.id, datasetRows.datasetId))
    .where(
      and(
        eq(datasets.status, "ready"),
        sql`nullif(${geoCountryName}, '') is not null`,
      ),
    )
    .orderBy(geoCountryName);

  return rows.map((row) => row.countryName);
}
