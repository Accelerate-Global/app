import {
  checksumImbValue,
  getImbFieldContractChecksum,
  getImbTransformationChecksum,
} from "@/lib/imb-forming/engine";
import {
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
  IMB_FORMING_TRANSFORMATION_VERSION,
} from "@/lib/imb-forming/field-contract";

import {
  checksumSourceFormingValue,
  deepFreezeSourceFormingValue,
} from "./canonical";
import type {
  SourceFieldContractEntry,
  SourceFormingContract,
} from "./types";

const lineageFields: readonly SourceFieldContractEntry[] = [
  { sourceField: null, outputField: "Data_Source", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_ID", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_Row_ID", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_Row_Key", type: "identifier", requiredSourceColumn: false },
];

export const ETNOPEDIA_SOURCE_PROFILE_KEY = "etnopedia-people-groups" as const;
export const JOSHUA_PROJECT_SOURCE_PROFILE_KEY = "joshua-project-pgic" as const;
export const WCD_SOURCE_PROFILE_KEY = "wcd-people-groups" as const;
export const ACCELERATE_SOURCE_PROFILE_KEY =
  "accelerate-owned-people-groups" as const;

export const ETNOPEDIA_SOURCE_CONTRACT = deepFreezeSourceFormingValue({
  schemaVersion: 1,
  key: "etnopedia-tier1-source",
  profileKind: "etnopedia",
  version: "2026-07-23.1",
  transformationVersion: "etnopedia-forming-v2",
  dataSourceCode: "et",
  fields: [
    { sourceField: "countries", outputField: "Geo_Country_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "ISO3", outputField: "Geo_ISO3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "primary_language", outputField: "Language_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "alternate_names", outputField: "PG_Name_Alt", type: "string", requiredSourceColumn: false },
    { sourceField: "title", outputField: "PG_Name_Main", type: "string", requiredSourceColumn: true, requiredMappedValue: true },
    { sourceField: "peid_list_json", outputField: "Source_PEID_Evidence", type: "string", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_PEID", type: "identifier", requiredSourceColumn: false },
    { sourceField: "peopleid3", outputField: "PG_PeopleID3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "rop1", outputField: "PG_ROP1", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP2", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP25", type: "identifier", requiredSourceColumn: false },
    { sourceField: "rop3", outputField: "PG_ROP3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "primary_or_principal_religion", outputField: "Religion_Name", type: "string", requiredSourceColumn: false },
    ...lineageFields,
  ],
  knownExcludedSourceFields: [
    "page_url", "talk_url", "page_revid", "page_timestamp", "talk_revid",
    "talk_timestamp", "photo_file", "photo_source", "countries_list_json",
    "population_total", "population_by_country_json", "reached_status",
    "reached_indicator_file", "reached_indicator_code", "reached_indicator_level",
    "reached_year", "alternate_names_list_json", "sign_language",
    "bible_translation_exists", "bible_translation_year", "bible_translation_notes",
    "bible_translation_detail", "map_title", "map_titles_json", "map_latitude",
    "map_longitude", "map_zoom", "map_source", "references_description",
    "references_statistics", "sections_json", "prayer_points_json",
    "wcdprn_list_json", "eupc", "profile_sources", "progress_jp_file",
    "progress_jp_year", "progress_gsec_file", "progress_gsec_year",
    "progress_overall_file", "progress_overall_year", "pageid", "page_id",
    "pageId",
  ],
  knownSourceFieldPatterns: [],
  stableIdentity: {
    kind: "etnopedia",
    pageIdFields: ["pageid", "page_id", "pageId"],
    titleField: "title",
  },
  country: {
    countryOutputField: "Geo_Country_Name",
    iso3OutputField: "Geo_ISO3",
    aliasNormalization: "nfkc",
    allowMultiCountryText: true,
  },
  rop: {
    rop1OutputField: "PG_ROP1",
    rop2OutputField: "PG_ROP2",
    rop25OutputField: "PG_ROP25",
    rop3OutputField: "PG_ROP3",
  },
} satisfies SourceFormingContract);

export const JOSHUA_PROJECT_SOURCE_CONTRACT = deepFreezeSourceFormingValue({
  schemaVersion: 1,
  key: "joshua-project-tier1-source",
  profileKind: "joshua-project",
  version: "2026-07-23.1",
  transformationVersion: "joshua-project-forming-v2",
  dataSourceCode: "jp",
  fields: [
    { sourceField: "Frontier", outputField: "Christianity_Frontier_Group", type: "boolean", requiredSourceColumn: false },
    { sourceField: "JPScale", outputField: "Christianity_Gospel_Progress_Scale", type: "integer", requiredSourceColumn: false },
    { sourceField: "LeastReached", outputField: "Christianity_Least_Reached", type: "boolean", requiredSourceColumn: false },
    { sourceField: "PercentAdherents", outputField: "Christianity_Percent_All_Types", type: "double", requiredSourceColumn: false },
    { sourceField: "PercentEvangelical", outputField: "Christianity_Percent_Evangelical", type: "double", requiredSourceColumn: false },
    { sourceField: "Window1040", outputField: "Geo_10_40_Window", type: "boolean", requiredSourceColumn: false },
    { sourceField: "Continent", outputField: "Geo_Continent_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "CountOfCountries", outputField: "Geo_Count_of_Countries", type: "integer", requiredSourceColumn: false },
    { sourceField: "Ctry", outputField: "Geo_Country_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "ISO3", outputField: "Geo_ISO3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Latitude", outputField: "Geo_Latitude", type: "double", requiredSourceColumn: false },
    { sourceField: "Longitude", outputField: "Geo_Longitude", type: "double", requiredSourceColumn: false },
    { sourceField: "RegionCode", outputField: "Geo_Region_Code", type: "integer", requiredSourceColumn: false },
    { sourceField: "RegionName", outputField: "Geo_Region_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "ROG2", outputField: "Geo_ROG2", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROG3", outputField: "Geo_ROG3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "IndigenousCode", outputField: "Indigenous_Code", type: "boolean", requiredSourceColumn: false },
    { sourceField: "PrimaryLanguageName", outputField: "Language_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "ROL3", outputField: "Language_ROL3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "AffinityBloc", outputField: "PG_Affinity_Bloc_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "PeopleCluster", outputField: "PG_Clusters_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "PeopNameInCountry", outputField: "PG_Name_Alt", type: "string", requiredSourceColumn: false },
    { sourceField: "PeopNameAcrossCountries", outputField: "PG_Name_Main", type: "string", requiredSourceColumn: false, requiredMappedValue: true },
    { sourceField: "PeopleID1", outputField: "PG_PeopleID1", type: "identifier", requiredSourceColumn: false },
    { sourceField: "PeopleID2", outputField: "PG_PeopleID2", type: "identifier", requiredSourceColumn: false },
    { sourceField: "PeopleID3", outputField: "PG_PeopleID3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Population", outputField: "PG_Population", type: "integer", requiredSourceColumn: false },
    { sourceField: "ROP1", outputField: "PG_ROP1", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROP2", outputField: "PG_ROP2", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP25", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROP3", outputField: "PG_ROP3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "PrimaryReligion", outputField: "Religion_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "RLG3", outputField: "Religion_RLG3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "BibleStatus", outputField: "Resources_Scripture_Translation_5_Point_Scale", type: "integer", requiredSourceColumn: false },
    { sourceField: "PercentEvangelicalPGAC", outputField: "Percent_Evangelical_PGAC", type: "string", requiredSourceColumn: false },
    { sourceField: "Resources_raw", outputField: "Resources_Source_JSON", type: "string", requiredSourceColumn: false },
    { sourceField: "ProfileText", outputField: "Source_Profile_Text", type: "string", requiredSourceColumn: false },
    ...lineageFields,
  ],
  knownExcludedSourceFields: ["ID", "id", "PeopleGroupID", "PeopleID"],
  knownSourceFieldPatterns: ["^Resource_\\d{2}_(?:ROL3|Category|WebText|URL)$"],
  stableIdentity: {
    kind: "joshua-project",
    providerIdFields: ["ID", "id", "PeopleGroupID", "PeopleID"],
    peopleId3Field: "PeopleID3",
    iso3Field: "ISO3",
  },
  country: {
    countryOutputField: "Geo_Country_Name",
    iso3OutputField: "Geo_ISO3",
    aliasNormalization: "nfkc",
    allowMultiCountryText: false,
  },
  rop: {
    rop1OutputField: "PG_ROP1",
    rop2OutputField: "PG_ROP2",
    rop25OutputField: "PG_ROP25",
    rop3OutputField: "PG_ROP3",
  },
} satisfies SourceFormingContract);

export const WCD_SOURCE_CONTRACT = deepFreezeSourceFormingValue({
  schemaVersion: 1,
  key: "wcd-tier1-source",
  profileKind: "wcd",
  version: "2026-07-23.1",
  transformationVersion: "wcd-forming-v2",
  dataSourceCode: "wc",
  fields: [
    { sourceField: "Country", outputField: "Geo_Country_Name", type: "string", requiredSourceColumn: false },
    { sourceField: null, outputField: "Geo_ISO3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROG Country Code", outputField: "Geo_ROG3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Ethnologue Language", outputField: "Language_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "People Name", outputField: "PG_Name_Main", type: "string", requiredSourceColumn: false, requiredMappedValue: true },
    { sourceField: "ROP1 Affinity Bloc code", outputField: "PG_ROP1", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP2", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP25", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROP People code", outputField: "PG_ROP3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Majority Religion", outputField: "Religion_Name", type: "string", requiredSourceColumn: false },
    ...lineageFields,
  ],
  knownExcludedSourceFields: [],
  knownSourceFieldPatterns: [],
  stableIdentity: { kind: "configured-column" },
  country: {
    countryOutputField: "Geo_Country_Name",
    iso3OutputField: "Geo_ISO3",
    aliasNormalization: "accent-punctuation-insensitive",
    allowMultiCountryText: false,
  },
  rop: {
    rop1OutputField: "PG_ROP1",
    rop2OutputField: "PG_ROP2",
    rop25OutputField: "PG_ROP25",
    rop3OutputField: "PG_ROP3",
  },
} satisfies SourceFormingContract);

export const ACCELERATE_SOURCE_CONTRACT = deepFreezeSourceFormingValue({
  schemaVersion: 1,
  key: "accelerate-tier1-source",
  profileKind: "accelerate",
  version: "2026-07-23.1",
  transformationVersion: "accelerate-forming-v2",
  dataSourceCode: "ax",
  fields: [
    { sourceField: "Non-Evangelical (Double)", outputField: "Christianity_Non_Evangelical_Christian_Percent_of_Pop", type: "double", requiredSourceColumn: false },
    { sourceField: "Engaged Phase/Scale In-Country (Integer)", outputField: "Engage_8_Phases_of_Engagement", type: "string", requiredSourceColumn: false },
    { sourceField: "Engaged in-country Y/N (Boolean)", outputField: "Engage_Binary", type: "boolean", requiredSourceColumn: false },
    { sourceField: "Engagment Sufficient? In-country (Integer)", outputField: "Engage_Engagement_Sufficiency_Scale", type: "string", requiredSourceColumn: false },
    { sourceField: "Engaged Est # Current in-country Gosp Workers (Integer)", outputField: "Engage_Estimated_Gospel_Workers", type: "integer", requiredSourceColumn: false },
    { sourceField: "Engagement First Touch in-country (Text)", outputField: "Engage_First_Touch_Index", type: "string", requiredSourceColumn: false },
    { sourceField: "Engage: Global Engagement Anywhere? (Engaged/Unengaged)", outputField: "Engage_Global_Engagement_Anywhere", type: "boolean", requiredSourceColumn: false },
    { sourceField: "Engagement Movement Oriented Y/N In-country (Boolean)", outputField: "Engage_Movement_Oriented", type: "boolean", requiredSourceColumn: false },
    { sourceField: "In-country Engagement Timestamp (DateTime)", outputField: "Engage_Timestamp_of_Changes", type: "datetime", requiredSourceColumn: false },
    { sourceField: "Engagement Verification Level in-country (Integer)", outputField: "Engage_Verification_Level", type: "integer", requiredSourceColumn: false },
    { sourceField: "Family Tree: 1 Down (Text)", outputField: "Family_Tree_Level_Down", type: "string", requiredSourceColumn: false },
    { sourceField: "Family Tree: 1 Up (Text)", outputField: "Family_Tree_Level_Up", type: "string", requiredSourceColumn: false },
    { sourceField: "Family Tree: Sisters (Text)", outputField: "Family_Tree_Sisters", type: "string", requiredSourceColumn: false },
    { sourceField: "Continent (Text)", outputField: "Geo_Continent_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "Country (Text)", outputField: "Geo_Country_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "Geo ISO3 (Text)", outputField: "Geo_ISO3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Diaspora (Boolean)", outputField: "Indigenous_Code", type: "boolean", requiredSourceColumn: false },
    { sourceField: "Language (Text)", outputField: "Language_Name", type: "string", requiredSourceColumn: false },
    { sourceField: "ROL (Text)", outputField: "Language_ROL3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Local Research Code (Integer)", outputField: "Other_Local_Research_Code", type: "integer", requiredSourceColumn: false },
    { sourceField: "Researcher Human Data (Text)", outputField: "Other_Researcher_Human_Data", type: "string", requiredSourceColumn: false },
    { sourceField: "Researcher Org Data (Text)", outputField: "Other_Researcher_Org_Data", type: "string", requiredSourceColumn: false },
    { sourceField: "People Group Name (Text)", outputField: "PG_Name_Main", type: "string", requiredSourceColumn: false, requiredMappedValue: true },
    { sourceField: "People Group: PEID (Integer)", outputField: "PG_PEID", type: "identifier", requiredSourceColumn: false },
    { sourceField: "People Group: PeopleID3 (Integer)", outputField: "PG_PeopleID3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "Population (Integer)", outputField: "PG_Population", type: "integer", requiredSourceColumn: false },
    { sourceField: "ROP1 (Text)", outputField: "PG_ROP1", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROP2 (Text)", outputField: "PG_ROP2", type: "identifier", requiredSourceColumn: false },
    { sourceField: null, outputField: "PG_ROP25", type: "identifier", requiredSourceColumn: false },
    { sourceField: "ROP3 (Integer)", outputField: "PG_ROP3", type: "identifier", requiredSourceColumn: false },
    { sourceField: "People Group: Specific (Notes)", outputField: "PG_Specific_Notes", type: "string", requiredSourceColumn: false },
    { sourceField: "Religion Assessment: Primary Religion (text)", outputField: "Religion_Name", type: "string", requiredSourceColumn: false },
    ...lineageFields,
  ],
  knownExcludedSourceFields: ["Data_Source", "Dataset_ID", "Dataset_Row_ID", "Dataset_Row_Key"],
  knownSourceFieldPatterns: [],
  stableIdentity: { kind: "configured-column" },
  country: {
    countryOutputField: "Geo_Country_Name",
    iso3OutputField: "Geo_ISO3",
    aliasNormalization: "nfkc",
    allowMultiCountryText: false,
  },
  rop: {
    rop1OutputField: "PG_ROP1",
    rop2OutputField: "PG_ROP2",
    rop25OutputField: "PG_ROP25",
    rop3OutputField: "PG_ROP3",
  },
} satisfies SourceFormingContract);

export const SOURCE_FORMING_CONTRACTS = deepFreezeSourceFormingValue([
  ETNOPEDIA_SOURCE_CONTRACT,
  JOSHUA_PROJECT_SOURCE_CONTRACT,
  WCD_SOURCE_CONTRACT,
  ACCELERATE_SOURCE_CONTRACT,
] as const);

export function getSourceFieldContractChecksum(contract: SourceFormingContract) {
  return checksumSourceFormingValue({
    schemaVersion: contract.schemaVersion,
    key: contract.key,
    version: contract.version,
    dataSourceCode: contract.dataSourceCode,
    fields: contract.fields,
  });
}

export function getSourceTypeContractChecksum(contract: SourceFormingContract) {
  return checksumSourceFormingValue({
    schemaVersion: contract.schemaVersion,
    key: contract.key,
    version: contract.version,
    fields: contract.fields.map(({ outputField, type }) => ({
      outputField,
      type,
    })),
  });
}

export function getImbTypeContractChecksum() {
  return checksumImbValue({
    schemaVersion: 1,
    key: "imb-type-contract",
    version: String(IMB_FIELD_CONTRACT_VERSION),
    fields: IMB_FIELD_CONTRACT.map(({ outputField, type }) => ({
      outputField,
      type,
    })),
  });
}

export function getSourceTransformationChecksum(contract: SourceFormingContract) {
  return checksumSourceFormingValue({
    key: contract.key,
    transformationVersion: contract.transformationVersion,
    fieldContractChecksum: getSourceFieldContractChecksum(contract),
    stableIdentity: contract.stableIdentity,
    country: contract.country,
    rop: contract.rop,
    duplicatePolicy: "stable-row-key-and-complete-rop3-iso3-block-v1",
    conversionRules: "source-semantic-conversion-v1",
    rowRetention: "all-structurally-readable-rows-v1",
  });
}

export const TIER1_SOURCE_CODE_CONTRACTS = deepFreezeSourceFormingValue({
  etnopedia: {
    fieldContractChecksum: getSourceFieldContractChecksum(ETNOPEDIA_SOURCE_CONTRACT),
    typeContractChecksum: getSourceTypeContractChecksum(ETNOPEDIA_SOURCE_CONTRACT),
    transformationChecksum: getSourceTransformationChecksum(ETNOPEDIA_SOURCE_CONTRACT),
  },
  joshuaProject: {
    fieldContractChecksum: getSourceFieldContractChecksum(JOSHUA_PROJECT_SOURCE_CONTRACT),
    typeContractChecksum: getSourceTypeContractChecksum(JOSHUA_PROJECT_SOURCE_CONTRACT),
    transformationChecksum: getSourceTransformationChecksum(JOSHUA_PROJECT_SOURCE_CONTRACT),
  },
  wcd: {
    fieldContractChecksum: getSourceFieldContractChecksum(WCD_SOURCE_CONTRACT),
    typeContractChecksum: getSourceTypeContractChecksum(WCD_SOURCE_CONTRACT),
    transformationChecksum: getSourceTransformationChecksum(WCD_SOURCE_CONTRACT),
  },
  accelerate: {
    fieldContractChecksum: getSourceFieldContractChecksum(ACCELERATE_SOURCE_CONTRACT),
    typeContractChecksum: getSourceTypeContractChecksum(ACCELERATE_SOURCE_CONTRACT),
    transformationChecksum: getSourceTransformationChecksum(ACCELERATE_SOURCE_CONTRACT),
  },
  imb: {
    fieldContractVersion: String(IMB_FIELD_CONTRACT_VERSION),
    transformationVersion: IMB_FORMING_TRANSFORMATION_VERSION,
    fieldContractChecksum: getImbFieldContractChecksum(),
    typeContractChecksum: getImbTypeContractChecksum(),
    transformationChecksum: getImbTransformationChecksum(),
  },
});
