import { checksumApiConnectionArtifact } from "@/lib/api-connection-output";

import { ApiConnectionError, isRecord } from "../core";
import type { ApiConnectionRecord } from "../provider";

export const IMB_API_CONNECTION_ID = "6f9f6ef2-1188-4f71-9c24-ef01debf7a01";
export const IMB_ARCGIS_QUERY_URL =
  "https://services2.arcgis.com/S4ydGgujXcif36k3/arcgis/rest/services/pIMBPeople/FeatureServer/0/query";
export const IMB_SOURCE_ADAPTER_NAME = "imb-arcgis-replacement";
export const IMB_SOURCE_ADAPTER_VERSION = "imb-arcgis-source-v2";

type ImbSourceFieldMapping = readonly [
  legacyField: string,
  replacementField: string | null,
];

/**
 * The replacement production layer uses descriptive attributes. Keep this
 * mapping ordered like the retired IMB export so archived CSVs and the pinned
 * forming contract remain deterministic. A null replacement is intentionally
 * blank because IMB no longer publishes a trustworthy equivalent.
 */
export const IMB_SOURCE_FIELD_MAPPINGS: readonly ImbSourceFieldMapping[] = [
  ["Aff", "AffAbbr"],
  ["AffCd", "imbAffinityCode"],
  ["Affbloc", "ROP1Name"],
  ["Audio", "AudioResourceAvailability"],
  ["Bible", "BibleAvailability"],
  ["CongExst", "CongregationsExist"],
  ["Ctry", "CountryName"],
  ["EngStat", "EngagementStatus"],
  ["Ethne", null],
  ["EvngLvl", "EvangelicalLevel"],
  ["GSEC", "GSEC"],
  ["GSECbrf", "GSECDescription"],
  ["GSEClng", "GSECLongDescription"],
  ["Gospel", "GospelResourceAvailability"],
  ["ISOalpha3", "ISOAlpha3"],
  ["Indigenous", "Indigenous"],
  ["Jesus", "JesusFilmAvailability"],
  ["Lang", "LanguageName"],
  ["LangFamily", "LanguageFamily"],
  ["Latitude", "Lat"],
  ["LocationDesc", "LocationDescription"],
  ["Longitude", "Long"],
  ["LvlBible", "BiblePortionsAvailability"],
  ["Name", "Name"],
  ["NmAlt", "AlternateNames"],
  ["NmDisp", "DisplayName"],
  ["OBJECTID", "OBJECTID"],
  ["PEID", "PEID"],
  ["PGID", "PGID"],
  ["PeopleDesc", "Description"],
  ["Photo", "HasPhoto"],
  ["PicCrdt", "PhotoCredit"],
  ["PicURL", "PhotoURL"],
  ["Plnting", "ChurchPlantingWithinLast2Years"],
  ["Pop", "Population"],
  ["PopCls", null],
  ["PplClstr", "ROP2Name"],
  ["PplNm", "ROP3Name"],
  ["ROG", null],
  ["ROL", "LanguageCode"],
  ["ROP1", "ROP1Code"],
  ["ROP2", "ROP2Code"],
  ["ROP25", "ROP25Code"],
  ["ROP3", "ROP3Code"],
  ["ROR", "ReligionCode"],
  ["ROR3", "ROR3"],
  ["ROR4", "ROR4"],
  ["RORdesc", "ReligionDescription"],
  ["Radio", "RadioProgramAvailability"],
  ["Regn", "UNm49RegionName"],
  ["RegnSub", "UNm49SubRegionName"],
  ["ResTot", "ResourceTotal"],
  ["Rlgn", "ReligionName"],
  ["RlgnBs", "RlgnBs"],
  ["RlgnDiv", null],
  ["SPI", "EngagementProgress"],
  ["SPIdesc", "EngagementProgressDesc"],
  ["Stories", "BibleStoriesAvailability"],
  ["YrPub", "BibleYearPublished"],
] as const;

export const IMB_REQUIRED_REPLACEMENT_FIELDS = [
  "OBJECTID",
  "PEID",
  "Name",
  "ISOAlpha3",
  "CountryName",
  "ROP3Code",
] as const;

export const IMB_SOURCE_ADAPTER_CHECKSUM = checksumApiConnectionArtifact(
  JSON.stringify({
    name: IMB_SOURCE_ADAPTER_NAME,
    version: IMB_SOURCE_ADAPTER_VERSION,
    requiredFields: IMB_REQUIRED_REPLACEMENT_FIELDS,
    mappings: IMB_SOURCE_FIELD_MAPPINGS,
  }),
);

export function getImbSourceAdapterMetadata() {
  return {
    name: IMB_SOURCE_ADAPTER_NAME,
    version: IMB_SOURCE_ADAPTER_VERSION,
    checksum: IMB_SOURCE_ADAPTER_CHECKSUM,
  } as const;
}

export function isImbApiConnection(connection: Pick<ApiConnectionRecord, "id">) {
  return connection.id === IMB_API_CONNECTION_ID;
}

export function adaptCurrentImbArcgisFeatures(features: unknown[]) {
  const attributeRows = features.map((feature) => {
    if (!isRecord(feature) || !isRecord(feature.attributes)) {
      throw new ApiConnectionError(
        "IMB ArcGIS response included a feature without attributes.",
        502,
      );
    }

    return feature.attributes;
  });
  const suppliedFields = new Set(
    attributeRows.flatMap((attributes) => Object.keys(attributes)),
  );
  const missingFields = IMB_REQUIRED_REPLACEMENT_FIELDS.filter(
    (field) => !suppliedFields.has(field),
  );

  if (missingFields.length > 0) {
    throw new ApiConnectionError(
      `IMB replacement source is missing required fields: ${missingFields.join(", ")}.`,
      502,
    );
  }

  return features.map((feature, index) => {
    const attributes = attributeRows[index]!;
    const adaptedAttributes = Object.fromEntries(
      IMB_SOURCE_FIELD_MAPPINGS.map(([legacyField, replacementField]) => [
        legacyField,
        replacementField ? (attributes[replacementField] ?? null) : null,
      ]),
    );

    return {
      ...(feature as Record<string, unknown>),
      attributes: adaptedAttributes,
    };
  });
}
