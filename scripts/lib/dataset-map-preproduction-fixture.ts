import isoCountryCatalog from "../../src/data/iso-country-codes.generated.json";

export const MAP_PREPRODUCTION_ROW_COUNT = 1_500;
export const MAP_PREPRODUCTION_FOCUSED_PEOPLE_NAME =
  "Rana Tharu Preproduction";

export type MapPreproductionDatasetRow = Record<string, string>;

type CountryProfile = {
  displayName: string;
  iso3: string;
};

const REPRESENTATIVE_COUNTRY_ISO3 = [
  "BHS",
  "BRN",
  "COG",
  "COD",
  "SWZ",
  "IND",
  "LAO",
  "SRB",
  "TZA",
  "TLS",
  "GBR",
] as const;

function getActiveCountryProfiles(): CountryProfile[] {
  return isoCountryCatalog.entries.flatMap((entry) =>
    entry.active && entry.primaryAlpha3
      ? [{ displayName: entry.displayName, iso3: entry.primaryAlpha3 }]
      : [],
  );
}

function createFilterValues(index: number, profile: CountryProfile) {
  return {
    christianity_gsec:
      profile.iso3 === "CAN" ? "5" : String((index % 5) + 1),
    christianity_frontier_group: index % 3 === 0 ? "true" : "false",
    pg_population: String(1_000 + ((index * 7_919) % 2_500_000)),
    percent_evangelical_pgac: ((index % 40) / 10).toFixed(1),
    engage_8_phases_of_engagement: String(index % 8),
    engage_global_engagement_anywhere: index % 4 === 0 ? "true" : "false",
  };
}

function createRow(input: {
  index: number;
  profile: CountryProfile;
  peopleName?: string;
  countryName?: string;
  iso3?: string;
}): MapPreproductionDatasetRow {
  const sequence = String(input.index + 1).padStart(4, "0");

  return {
    pg_peopleid1: `MAP-PRE-${sequence}`,
    pg_peid: `MAP-PEID-${sequence}`,
    people_name:
      input.peopleName ?? `${input.profile.displayName} People ${sequence}`,
    geo_country_name: input.countryName ?? input.profile.displayName,
    geo_iso3: input.iso3 ?? input.profile.iso3,
    ...createFilterValues(input.index, input.profile),
  };
}

export function buildMapPreproductionRows(
  rowCount = MAP_PREPRODUCTION_ROW_COUNT,
): MapPreproductionDatasetRow[] {
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) {
    throw new Error("Map pre-production row count must be a positive integer.");
  }

  const profiles = getActiveCountryProfiles();
  const profileByIso3 = new Map(
    profiles.map((profile) => [profile.iso3, profile] as const),
  );
  const representativeProfiles = REPRESENTATIVE_COUNTRY_ISO3.map((iso3) => {
    const profile = profileByIso3.get(iso3);

    if (!profile) {
      throw new Error(`Missing required country catalog profile: ${iso3}`);
    }

    return profile;
  });
  const weightedProfiles = profiles.flatMap((profile, index) =>
    Array.from({ length: (index % 5) + 1 }, () => profile),
  );
  const rows: MapPreproductionDatasetRow[] = representativeProfiles.map(
    (profile, index) =>
      createRow({
        index,
        profile,
        peopleName:
          profile.iso3 === "IND"
            ? MAP_PREPRODUCTION_FOCUSED_PEOPLE_NAME
            : undefined,
        // Exercise the reviewed country-name path for representative AX names.
        iso3: "",
      }),
  );

  for (let index = rows.length; index < rowCount; index += 1) {
    const profile = weightedProfiles[(index * 17) % weightedProfiles.length]!;
    const missingGeography = index % 149 === 0;
    const unknownIso3 = !missingGeography && index % 137 === 0;

    rows.push(
      createRow({
        index,
        profile,
        countryName: missingGeography ? "" : profile.displayName,
        iso3: missingGeography ? "" : unknownIso3 ? "XXX" : profile.iso3,
      }),
    );
  }

  return rows;
}

export const MAP_PREPRODUCTION_DEFAULT_FILTERED_ROW_COUNT =
  buildMapPreproductionRows().filter((row) => row.geo_country_name).length;
