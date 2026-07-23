import { describe, expect, it } from "vitest";

import { formAccelerateRows } from "./accelerate";
import {
  ACCELERATE_SOURCE_CONTRACT,
  ACCELERATE_SOURCE_PROFILE_KEY,
  ETNOPEDIA_SOURCE_CONTRACT,
  ETNOPEDIA_SOURCE_PROFILE_KEY,
  JOSHUA_PROJECT_SOURCE_CONTRACT,
  JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
  WCD_SOURCE_CONTRACT,
  WCD_SOURCE_PROFILE_KEY,
} from "./contracts";
import { formEtnopediaRows } from "./etnopedia";
import {
  SOURCE_FORMING_COUNTRIES,
  SOURCE_FORMING_JP_CROSSWALK,
  SOURCE_FORMING_ROP_ENTRIES,
  completeExpectedRow,
  outputRowByLabel,
  sourceRows,
} from "./fixtures";
import { formJoshuaProjectRows } from "./joshua-project";
import type { SourceFormingResources } from "./types";
import { formWcdRows } from "./wcd";

const resources: SourceFormingResources = {
  countries: SOURCE_FORMING_COUNTRIES,
  ropEntries: SOURCE_FORMING_ROP_ENTRIES,
  jpPeopleId3Entries: SOURCE_FORMING_JP_CROSSWALK,
};

function validationDefaults(input: {
  warnings?: number;
  errors?: number;
  rows?: number;
  missingStable?: number;
  duplicateStable?: number;
  duplicateDomain?: number;
  unresolvedCountry?: number;
  ambiguousCountry?: number;
  countryConflict?: number;
  unresolvedRop?: number;
  ropConflict?: number;
  invalidValues?: number;
  drift?: string[];
} = {}) {
  return {
    warningCount: input.warnings ?? 0,
    errorCount: input.errors ?? 0,
    inputRowCount: input.rows ?? 1,
    outputRowCount: input.rows ?? 1,
    missingStableKeyRows: input.missingStable ?? 0,
    duplicateStableKeyRows: input.duplicateStable ?? 0,
    duplicateDomainKeyRows: input.duplicateDomain ?? 0,
    unresolvedCountryRows: input.unresolvedCountry ?? 0,
    ambiguousCountryRows: input.ambiguousCountry ?? 0,
    countryConflictRows: input.countryConflict ?? 0,
    unresolvedRopRows: input.unresolvedRop ?? 0,
    ropParentConflictRows: input.ropConflict ?? 0,
    invalidValueCount: input.invalidValues ?? 0,
    schemaDriftFields: input.drift ?? [],
  };
}

describe("Etnopedia source forming", () => {
  it("matches the approved whole-output golden while preserving page identity", () => {
    const source = sourceRows([
      {
        pageid: "501",
        title: "Alpha People",
        countries: "United States of America",
        ISO3: "",
        primary_language: "English",
        alternate_names: "A People; Alpha",
        peid_list_json: '["42"]',
        peopleid3: "7001",
        rop1: "A999",
        rop3: "100001",
        primary_or_principal_religion: "Christianity",
      },
    ]);
    const result = formEtnopediaRows({
      sourceProfileKey: ETNOPEDIA_SOURCE_PROFILE_KEY,
      sourceRunId: "run-et",
      ...source,
      resources,
    });
    const stableRowKey = "etnopedia-people-groups:pageid:501";

    expect(result.columns.map((column) => column.label)).toEqual(
      ETNOPEDIA_SOURCE_CONTRACT.fields.map((field) => field.outputField),
    );
    expect(outputRowByLabel(result)).toEqual(
      completeExpectedRow(ETNOPEDIA_SOURCE_CONTRACT, {
        Geo_Country_Name: "United States",
        Geo_ISO3: "USA",
        Language_Name: "English",
        PG_Name_Alt: "A People; Alpha",
        PG_Name_Main: "Alpha People",
        Source_PEID_Evidence: '["42"]',
        PG_PEID: "42",
        PG_PeopleID3: "7001",
        PG_ROP1: "A001",
        PG_ROP2: "C0001",
        PG_ROP25: "300001",
        PG_ROP3: "100001",
        Religion_Name: "Christianity",
        Data_Source: "et",
        Dataset_ID: "run-et",
        Dataset_Row_ID: "501",
        Dataset_Row_Key: stableRowKey,
      }),
    );
    expect(result.findings).toEqual([
      {
        severity: "warning",
        ruleCode: "rop-parent-conflict",
        sourceRowIndex: 0,
        stableRowKey,
        fieldName: "PG_ROP3",
        sourceValue: "100001",
        canonicalValue: "100001",
        message: "Source ROP parents differ from the exact pinned ROP3 hierarchy.",
        details: {
          sourceParents: { rop1: "A999", rop2: "", rop25: "" },
          canonicalParents: {
            rop1: "A001",
            rop2: "C0001",
            rop25: "300001",
          },
        },
      },
    ]);
    expect(result.validation).toEqual(
      validationDefaults({ warnings: 1, ropConflict: 1 }),
    );
    expect(result.valid).toBe(true);
    expect(result.outputChecksum).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("preserves multi-country and multi-PEID rows with source evidence", () => {
    const source = sourceRows([
      {
        title: "Cross-border People",
        countries: "India; Pakistan",
        peid_list_json: '["1","2"]',
        rop3: "",
      },
    ]);
    const result = formEtnopediaRows({
      sourceProfileKey: ETNOPEDIA_SOURCE_PROFILE_KEY,
      sourceRunId: "run-et",
      ...source,
      resources,
    });

    expect(result.rows).toHaveLength(1);
    expect(outputRowByLabel(result)).toMatchObject({
      Geo_Country_Name: "India; Pakistan",
      Geo_ISO3: "",
      PG_PEID: "",
      Source_PEID_Evidence: '["1","2"]',
      Dataset_Row_ID: "Cross-border People",
      Dataset_Row_Key:
        "etnopedia-people-groups:title:cross-border people",
    });
    expect(result.findings.map((finding) => finding.ruleCode)).toEqual([
      "non-scalar-peid-evidence",
      "multi-country-source-value",
      "unresolved-rop3",
    ]);
    expect(result.valid).toBe(true);
  });

  it("blocks missing or colliding title fallback identities without dropping rows", () => {
    const duplicateSource = sourceRows([
      { title: "Same Title", countries: "US", rop3: "100001" },
      { title: "Ｓame   Title", countries: "US", rop3: "100002" },
    ]);
    const duplicate = formEtnopediaRows({
      sourceProfileKey: ETNOPEDIA_SOURCE_PROFILE_KEY,
      sourceRunId: "run-et",
      ...duplicateSource,
      resources,
    });
    expect(duplicate.rows).toHaveLength(2);
    expect(duplicate.validation.duplicateStableKeyRows).toBe(2);
    expect(duplicate.valid).toBe(false);

    const missingSource = sourceRows([{ countries: "US", rop3: "100001" }]);
    const missing = formEtnopediaRows({
      sourceProfileKey: ETNOPEDIA_SOURCE_PROFILE_KEY,
      sourceRunId: "run-et",
      ...missingSource,
      resources,
    });
    expect(missing.rows).toHaveLength(1);
    expect(missing.findings.map((finding) => finding.ruleCode)).toContain(
      "missing-required-source-field",
    );
    expect(missing.validation.missingStableKeyRows).toBe(1);
    expect(missing.valid).toBe(false);
  });
});

describe("Joshua Project source forming", () => {
  it("matches the approved whole-output golden with PeopleID and resource evidence", () => {
    const source = sourceRows([
      {
        ID: "jp-record-1",
        Frontier: "Y",
        JPScale: "2",
        LeastReached: "true",
        PercentAdherents: "12.5",
        PercentEvangelical: "3.25",
        Window1040: "No",
        Continent: "North America",
        CountOfCountries: "1",
        Ctry: "United States of America",
        ISO3: "",
        Latitude: "38.5",
        Longitude: "-97.5",
        RegionCode: "21",
        RegionName: "Americas",
        ROG2: "NA",
        ROG3: "USA",
        IndigenousCode: "Indigenous",
        PrimaryLanguageName: "English",
        ROL3: "eng",
        AffinityBloc: "North American Peoples",
        PeopleCluster: "Anglo-American",
        PeopNameInCountry: "Alpha in the United States",
        PeopNameAcrossCountries: "Alpha",
        PeopleID1: "1",
        PeopleID2: "70",
        PeopleID3: "7001",
        Population: "1,250",
        ROP1: "",
        ROP2: "",
        ROP3: "",
        PrimaryReligion: "Christianity",
        RLG3: "100",
        BibleStatus: "5",
        PercentEvangelicalPGAC: "3.25",
        Resources_raw: '[{"Category":"Audio"}]',
        ProfileText: '{"summary":"Profile"}',
      },
    ]);
    const result = formJoshuaProjectRows({
      sourceProfileKey: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
      sourceRunId: "run-jp",
      ...source,
      resources,
    });

    expect(outputRowByLabel(result)).toEqual(
      completeExpectedRow(JOSHUA_PROJECT_SOURCE_CONTRACT, {
        Christianity_Frontier_Group: "TRUE",
        Christianity_Gospel_Progress_Scale: "2",
        Christianity_Least_Reached: "TRUE",
        Christianity_Percent_All_Types: "12.5",
        Christianity_Percent_Evangelical: "3.25",
        Geo_10_40_Window: "FALSE",
        Geo_Continent_Name: "North America",
        Geo_Count_of_Countries: "1",
        Geo_Country_Name: "United States",
        Geo_ISO3: "USA",
        Geo_Latitude: "38.5",
        Geo_Longitude: "-97.5",
        Geo_Region_Code: "21",
        Geo_Region_Name: "Americas",
        Geo_ROG2: "NA",
        Geo_ROG3: "USA",
        Indigenous_Code: "TRUE",
        Language_Name: "English",
        Language_ROL3: "eng",
        PG_Affinity_Bloc_Name: "North American Peoples",
        PG_Clusters_Name: "Anglo-American",
        PG_Name_Alt: "Alpha in the United States",
        PG_Name_Main: "Alpha",
        PG_PeopleID1: "1",
        PG_PeopleID2: "70",
        PG_PeopleID3: "7001",
        PG_Population: "1250",
        PG_ROP1: "A001",
        PG_ROP2: "C0001",
        PG_ROP25: "300001",
        PG_ROP3: "100001",
        Religion_Name: "Christianity",
        Religion_RLG3: "100",
        Resources_Scripture_Translation_5_Point_Scale: "5",
        Percent_Evangelical_PGAC: "3.25",
        Resources_Source_JSON: '[{"Category":"Audio"}]',
        Source_Profile_Text: '{"summary":"Profile"}',
        Data_Source: "jp",
        Dataset_ID: "run-jp",
        Dataset_Row_ID: "jp-record-1",
        Dataset_Row_Key:
          "joshua-project-pgic:provider-id:jp-record-1",
      }),
    );
    expect(result.findings).toEqual([]);
    expect(result.validation).toEqual(validationDefaults());
    expect(result.valid).toBe(true);
  });

  it("uses PeopleID3 plus canonical ISO3 only when no provider ID exists", () => {
    const source = sourceRows([
      {
        PeopleID3: "7001",
        PeopNameAcrossCountries: "Alpha",
        Ctry: "US",
        ROP3: "100001",
      },
    ]);
    const result = formJoshuaProjectRows({
      sourceProfileKey: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
      sourceRunId: "run-jp",
      ...source,
      resources,
    });
    expect(outputRowByLabel(result).Dataset_Row_Key).toBe(
      "joshua-project-pgic:peopleid3-iso3:7001:usa",
    );
    expect(result.valid).toBe(true);
  });

  it("blocks every duplicate complete ROP3 and ISO3 row", () => {
    const source = sourceRows([
      {
        ID: "one",
        PeopleID3: "7001",
        PeopNameAcrossCountries: "Alpha",
        ISO3: "USA",
        ROP3: "100001",
      },
      {
        ID: "two",
        PeopleID3: "9999",
        PeopNameAcrossCountries: "Beta",
        ISO3: "USA",
        ROP3: "100001",
      },
    ]);
    const result = formJoshuaProjectRows({
      sourceProfileKey: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
      sourceRunId: "run-jp",
      ...source,
      resources,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.validation.duplicateDomainKeyRows).toBe(2);
    expect(
      result.findings.filter(
        (finding) => finding.ruleCode === "duplicate-complete-domain-key",
      ).map((finding) => finding.sourceRowIndex),
    ).toEqual([0, 1]);
    expect(result.valid).toBe(false);
  });

  it("blocks a blank required people-name mapping", () => {
    const source = sourceRows([
      {
        ID: "jp-record-missing-name",
        PeopNameAcrossCountries: "",
        ISO3: "USA",
        ROP3: "100001",
      },
    ]);
    const result = formJoshuaProjectRows({
      sourceProfileKey: JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
      sourceRunId: "run-jp",
      ...source,
      resources,
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          ruleCode: "missing-required-mapped-value",
          fieldName: "PG_Name_Main",
        }),
      ]),
    );
    expect(result.valid).toBe(false);
  });
});

describe("WCD source forming", () => {
  it("matches the whole-output golden with configured identity and exact loose alias", () => {
    const source = sourceRows([
      {
        "Record Key": "W-001",
        Country: "Cote-d Ivoire",
        "ROG Country Code": "CIV",
        "Ethnologue Language": "French",
        "People Name": "Alpha",
        "ROP1 Affinity Bloc code": "A999",
        "ROP People code": "100001",
        "Majority Religion": "Christianity",
      },
    ]);
    const result = formWcdRows({
      sourceProfileKey: WCD_SOURCE_PROFILE_KEY,
      sourceRunId: "run-wcd",
      ...source,
      resources: { ...resources, stableKeyColumn: "Record Key" },
    });
    const stableRowKey = "wcd-people-groups:source-key:w-001";

    expect(outputRowByLabel(result)).toEqual(
      completeExpectedRow(WCD_SOURCE_CONTRACT, {
        Geo_Country_Name: "Côte d’Ivoire",
        Geo_ISO3: "CIV",
        Geo_ROG3: "CIV",
        Language_Name: "French",
        PG_Name_Main: "Alpha",
        PG_ROP1: "A001",
        PG_ROP2: "C0001",
        PG_ROP25: "300001",
        PG_ROP3: "100001",
        Religion_Name: "Christianity",
        Data_Source: "wc",
        Dataset_ID: "run-wcd",
        Dataset_Row_ID: "W-001",
        Dataset_Row_Key: stableRowKey,
      }),
    );
    expect(result.findings.map((finding) => finding.ruleCode)).toEqual([
      "rop-parent-conflict",
    ]);
    expect(result.valid).toBe(true);
  });

  it("blocks a missing configured stable key without row ordinal fallback", () => {
    const source = sourceRows([
      {
        Country: "US",
        "People Name": "Alpha",
        "ROP People code": "100001",
      },
    ]);
    const result = formWcdRows({
      sourceProfileKey: WCD_SOURCE_PROFILE_KEY,
      sourceRunId: "run-wcd",
      ...source,
      resources,
    });
    expect(outputRowByLabel(result).Dataset_Row_ID).toBe("");
    expect(result.findings.map((finding) => finding.ruleCode)).toEqual(
      expect.arrayContaining([
        "missing-stable-key-configuration",
        "missing-stable-source-identity",
      ]),
    );
    expect(result.valid).toBe(false);
  });
});

describe("Accelerate-owned source forming", () => {
  it("matches the whole-output golden and ignores source-provided AX identity", () => {
    const source = sourceRows([
      {
        "Source UUID": "AX-900",
        "Non-Evangelical (Double)": "12.50",
        "Engaged Phase/Scale In-Country (Integer)": "4",
        "Engaged in-country Y/N (Boolean)": "yes",
        "Engagment Sufficient? In-country (Integer)": "2",
        "Engaged Est # Current in-country Gosp Workers (Integer)": "1,234",
        "Engagement First Touch in-country (Text)": "Local partner",
        "Engage: Global Engagement Anywhere? (Engaged/Unengaged)": "Engaged",
        "Engagement Movement Oriented Y/N In-country (Boolean)": "no",
        "In-country Engagement Timestamp (DateTime)": "2026-07-22T10:00:00Z",
        "Engagement Verification Level in-country (Integer)": "3",
        "Family Tree: 1 Down (Text)": "Child",
        "Family Tree: 1 Up (Text)": "Parent",
        "Family Tree: Sisters (Text)": "Sister",
        "Continent (Text)": "North America",
        "Country (Text)": "US",
        "Geo ISO3 (Text)": "",
        "Diaspora (Boolean)": "Diaspora",
        "Language (Text)": "English",
        "ROL (Text)": "eng",
        "Local Research Code (Integer)": "5",
        "Researcher Human Data (Text)": "Researcher",
        "Researcher Org Data (Text)": "Organization",
        "People Group Name (Text)": "Alpha",
        "People Group: PEID (Integer)": "42",
        "People Group: PeopleID3 (Integer)": "7001",
        "Population (Integer)": "10,000",
        "ROP1 (Text)": "A999",
        "ROP2 (Text)": "C9999",
        "ROP3 (Integer)": "100001",
        "People Group: Specific (Notes)": "Reviewed",
        "Religion Assessment: Primary Religion (text)": "Christianity",
        Data_Source: "untrusted",
        Dataset_ID: "untrusted-run",
        Dataset_Row_ID: "999",
        Dataset_Row_Key: "untrusted-key",
      },
    ]);
    const result = formAccelerateRows({
      sourceProfileKey: ACCELERATE_SOURCE_PROFILE_KEY,
      sourceRunId: "run-ax",
      ...source,
      resources: { ...resources, stableKeyColumn: "Source UUID" },
    });
    const stableRowKey =
      "accelerate-owned-people-groups:source-key:ax-900";

    expect(outputRowByLabel(result)).toEqual(
      completeExpectedRow(ACCELERATE_SOURCE_CONTRACT, {
        Christianity_Non_Evangelical_Christian_Percent_of_Pop: "12.5",
        Engage_8_Phases_of_Engagement: "4",
        Engage_Binary: "TRUE",
        Engage_Engagement_Sufficiency_Scale: "2",
        Engage_Estimated_Gospel_Workers: "1234",
        Engage_First_Touch_Index: "Local partner",
        Engage_Global_Engagement_Anywhere: "TRUE",
        Engage_Movement_Oriented: "FALSE",
        Engage_Timestamp_of_Changes: "2026-07-22T10:00:00.000Z",
        Engage_Verification_Level: "3",
        Family_Tree_Level_Down: "Child",
        Family_Tree_Level_Up: "Parent",
        Family_Tree_Sisters: "Sister",
        Geo_Continent_Name: "North America",
        Geo_Country_Name: "United States",
        Geo_ISO3: "USA",
        Indigenous_Code: "FALSE",
        Language_Name: "English",
        Language_ROL3: "eng",
        Other_Local_Research_Code: "5",
        Other_Researcher_Human_Data: "Researcher",
        Other_Researcher_Org_Data: "Organization",
        PG_Name_Main: "Alpha",
        PG_PEID: "42",
        PG_PeopleID3: "7001",
        PG_Population: "10000",
        PG_ROP1: "A001",
        PG_ROP2: "C0001",
        PG_ROP25: "300001",
        PG_ROP3: "100001",
        PG_Specific_Notes: "Reviewed",
        Religion_Name: "Christianity",
        Data_Source: "ax",
        Dataset_ID: "run-ax",
        Dataset_Row_ID: "AX-900",
        Dataset_Row_Key: stableRowKey,
      }),
    );
    expect(result.findings.map((finding) => finding.ruleCode)).toEqual([
      "rop-parent-conflict",
    ]);
    expect(result.valid).toBe(true);
  });

  it("reports schema drift and type failures while preserving the row", () => {
    const source = sourceRows([
      {
        "Source UUID": "AX-901",
        "Country (Text)": "US",
        "ROP3 (Integer)": "100002",
        "People Group Name (Text)": "Typed Alpha",
        "Non-Evangelical (Double)": "not-a-number",
        "In-country Engagement Timestamp (DateTime)": "yesterday",
        "Unexpected Column": "evidence",
      },
    ]);
    const result = formAccelerateRows({
      sourceProfileKey: ACCELERATE_SOURCE_PROFILE_KEY,
      sourceRunId: "run-ax",
      ...source,
      resources: { ...resources, stableKeyColumn: "Source UUID" },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.validation.invalidValueCount).toBe(2);
    expect(result.validation.schemaDriftFields).toEqual(["Unexpected Column"]);
    expect(
      result.findings.filter(
        (finding) => finding.ruleCode === "invalid-source-value",
      ),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        fieldName:
          "Christianity_Non_Evangelical_Christian_Percent_of_Pop",
      }),
      expect.objectContaining({
        severity: "error",
        fieldName: "Engage_Timestamp_of_Changes",
      }),
    ]);
    expect(result.valid).toBe(false);
  });
});
