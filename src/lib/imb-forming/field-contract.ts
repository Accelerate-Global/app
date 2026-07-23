export const IMB_FIELD_CONTRACT_VERSION = 2 as const;
export const IMB_FORMING_TRANSFORMATION_VERSION = "imb-forming-v2" as const;
export const IMB_DATA_SOURCE_CODE = "im" as const;

export type ImbFieldSemanticType =
  | "string"
  | "boolean"
  | "integer"
  | "double"
  | "identifier";

export type ImbFieldContractEntry = {
  sourceField: string | null;
  outputField: string;
  type: ImbFieldSemanticType;
  requiredSourceColumn: boolean;
  requiredMappedValue?: boolean;
};

export const IMB_FIELD_CONTRACT: readonly ImbFieldContractEntry[] = [
  { sourceField: "PEID", outputField: "PG_PEID", type: "identifier", requiredSourceColumn: true },
  { sourceField: "Name", outputField: "PG_Name_Main", type: "string", requiredSourceColumn: true, requiredMappedValue: true },
  { sourceField: "ISOalpha3", outputField: "Geo_ISO3", type: "identifier", requiredSourceColumn: true },
  { sourceField: "Ctry", outputField: "Geo_Country_Name", type: "string", requiredSourceColumn: true },
  { sourceField: "Regn", outputField: "Geo_Continent_Name", type: "string", requiredSourceColumn: false },
  { sourceField: "RegnSub", outputField: "Geo_Sub_Continent", type: "string", requiredSourceColumn: false },
  { sourceField: "ROG", outputField: "Geo_ROG3", type: "identifier", requiredSourceColumn: false },
  { sourceField: "Aff", outputField: "PG_Affinity", type: "string", requiredSourceColumn: false },
  { sourceField: "Pop", outputField: "PG_Population", type: "integer", requiredSourceColumn: false },
  { sourceField: "PopCls", outputField: "PG_Population_Range_Layer", type: "string", requiredSourceColumn: false },
  { sourceField: "EngStat", outputField: "Engage_Global_Engagement_Anywhere", type: "boolean", requiredSourceColumn: false },
  { sourceField: "GSEC", outputField: "Christianity_GSEC", type: "integer", requiredSourceColumn: false },
  { sourceField: "SPI", outputField: "Engage_Engagement_Code_SPI", type: "integer", requiredSourceColumn: false },
  { sourceField: "SPIdesc", outputField: "Engage_Engagement_Level_SPI", type: "string", requiredSourceColumn: false },
  { sourceField: "ROL", outputField: "Language_ROL3", type: "identifier", requiredSourceColumn: false },
  { sourceField: "Lang", outputField: "Language_Name", type: "string", requiredSourceColumn: false },
  { sourceField: "Rlgn", outputField: "Religion_Name", type: "string", requiredSourceColumn: false },
  { sourceField: "ROP3", outputField: "PG_ROP3", type: "identifier", requiredSourceColumn: true },
  { sourceField: "PplNm", outputField: "PG_Name_Alt", type: "string", requiredSourceColumn: false },
  { sourceField: "ROP25", outputField: "PG_ROP25", type: "identifier", requiredSourceColumn: false },
  { sourceField: "ROP2", outputField: "PG_ROP2", type: "identifier", requiredSourceColumn: false },
  { sourceField: "PplClstr", outputField: "PG_Clusters_Name", type: "string", requiredSourceColumn: false },
  { sourceField: "ROP1", outputField: "PG_ROP1", type: "identifier", requiredSourceColumn: false },
  { sourceField: "Affbloc", outputField: "PG_Affinity_Bloc_Name", type: "string", requiredSourceColumn: false },
  { sourceField: "Jesus", outputField: "Resources_Jesus_Film", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Radio", outputField: "Resources_Radio_Broadcast", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Gospel", outputField: "Resources_Gospel_Recordings", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Audio", outputField: "Resources_Audio_Scripture", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Bible", outputField: "Resources_Written_Scripture", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Indigenous", outputField: "Indigenous_Code", type: "boolean", requiredSourceColumn: false },
  { sourceField: "Latitude", outputField: "Geo_Latitude", type: "double", requiredSourceColumn: false },
  { sourceField: "Longitude", outputField: "Geo_Longitude", type: "double", requiredSourceColumn: false },
  { sourceField: null, outputField: "Data_Source", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_ID", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_Row_ID", type: "identifier", requiredSourceColumn: false },
  { sourceField: null, outputField: "Dataset_Row_Key", type: "identifier", requiredSourceColumn: false },
] as const;

export const IMB_KNOWN_EXCLUDED_SOURCE_FIELDS = new Set([
  "OBJECTID",
  "PGID",
  "NmDisp",
  "NmAlt",
  "AffCd",
  "PeopleDesc",
  "LocationDesc",
  "EvngLvl",
  "CongExst",
  "Plnting",
  "GSECbrf",
  "GSEClng",
  "LangFamily",
  "ROR",
  "RORdesc",
  "ROR3",
  "RlgnBs",
  "ROR4",
  "RlgnDiv",
  "Ethne",
  "Stories",
  "ResTot",
  "LvlBible",
  "YrPub",
  "PicCrdt",
  "PicURL",
  "Photo",
  "geometry_x",
  "geometry_y",
]);
