import { describe, expect, it } from "vitest";

import * as validationModule from "@/lib/validation";
import {
  apiConnectionCreateSchema,
  createDatasetSchema,
  datasetAssignDerivedViewSchema,
  datasetMetadataPatchSchema,
  replaceDatasetSchema,
} from "@/lib/validation";

describe("datasetMetadataPatchSchema", () => {
  it("does not expose the removed filter region editor schema", () => {
    expect("filterRegionPayloadSchema" in validationModule).toBe(false);
  });

  it("does not expose the removed field source write schemas", () => {
    expect("fieldSourcePatchSchema" in validationModule).toBe(false);
    expect("fieldSourceTypeCreateSchema" in validationModule).toBe(false);
  });

  it("accepts a public visibility-only update", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      isPublic: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.isPublic).toBe(false);
  });

  it("accepts normalized dataset tags without preset metadata", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-1",
          label: " Watchlist ",
          color: "#262531",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.tags).toEqual([
      {
        id: "tag-1",
        label: "Watchlist",
        color: "#262531",
      },
    ]);
  });

  it("ignores removed preset metadata in tag payloads", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      tags: [
        {
          id: "tag-1",
          label: "Legacy",
          color: "#262531",
          openPreset: {
            country: {
              enabled: true,
              selectedCountryNames: ["Jordan"],
            },
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.tags).toEqual([
      {
        id: "tag-1",
        label: "Legacy",
        color: "#262531",
      },
    ]);
  });

  it("accepts an explicit source organization name", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      sourceOrganizationName: " Joshua Project ",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.sourceOrganizationName).toBe("Joshua Project");
  });

  it("allows admins to clear a source organization name", () => {
    const result = datasetMetadataPatchSchema.safeParse({
      sourceOrganizationName: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.sourceOrganizationName).toBeNull();
  });
});

describe("datasetAssignDerivedViewSchema", () => {
  it("accepts a valid persisted filtered-view assignment payload", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["10000000-0000-4000-8000-000000000001"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India", "Nepal"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [
          {
            id: "people_name",
            desc: false,
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.hotspots).toEqual({
      enabled: false,
      metric: "unique_uupgs",
      countryCount: 10,
    });
    expect(result.data.filters.country.includeAlternateCountries).toBe(false);
    expect(result.data.filters.uupg).toEqual({
      enabled: false,
      globalEngagementAnywhereEnabled: true,
      frontierGroupEnabled: true,
    });
  });

  it("keeps legacy persisted region labels syntactically valid", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["10000000-0000-4000-8000-000000000001"],
          selectedRegionNames: ["South Asia"],
          enabledCountryNames: ["India", "Nepal"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it("defaults a missing watchlist frontier-group value to true", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.watchlist.jpOnlyEvangelicalCriteriaEnabled).toBe(
      true,
    );
    expect(result.data.filters.watchlist.frontierGroupValue).toBe(true);
  });

  it("accepts a custom JP-only evangelical rule", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: true,
          threshold: 2,
          engagementPhaseThreshold: 6,
          jpOnlyEvangelicalRule: {
            minBelievers: 90,
            maxBelievers: 300000,
            maxPercentEvangelical: 2.5,
          },
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.watchlist.jpOnlyEvangelicalRule).toEqual({
      minBelievers: 90,
      maxBelievers: 300000,
      maxPercentEvangelical: 2.5,
    });
  });

  it("accepts versioned custom GSEC and engagement-phase rules", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: true,
          thresholdRuleVersion: 1,
          threshold: 4,
          engagementPhaseThreshold: 4,
          engagementPhaseRule: {
            minPhase: 1,
            maxPhase: 4,
          },
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.filters.watchlist.thresholdRuleVersion).toBe(1);
    expect(result.data.filters.watchlist.threshold).toBe(4);
    expect(result.data.filters.watchlist.engagementPhaseRule).toEqual({
      minPhase: 1,
      maxPhase: 4,
    });
  });

  it("rejects an engagement-phase rule whose max phase is below the min phase", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: true,
          threshold: 2,
          engagementPhaseThreshold: 4,
          engagementPhaseRule: {
            minPhase: 4,
            maxPhase: 1,
          },
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.path.includes("maxPhase")),
    ).toBe(true);
  });

  it("rejects a JP-only evangelical rule whose max believers is below the min believers", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: true,
          threshold: 2,
          engagementPhaseThreshold: 6,
          jpOnlyEvangelicalRule: {
            minBelievers: 90,
            maxBelievers: 80,
            maxPercentEvangelical: 2.5,
          },
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.path.includes("maxBelievers")),
    ).toBe(true);
  });

  it("rejects invalid region ids inside the saved filter state", () => {
    const result = datasetAssignDerivedViewSchema.safeParse({
      sourceDatasetId: "f0000000-0000-4000-8000-000000000099",
      filters: {
        region: {
          enabled: true,
          selectedRegionIds: ["south-asia"],
          selectedRegionNames: ["Asia, South"],
          enabledCountryNames: ["India"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: false,
          threshold: 2,
          engagementPhaseThreshold: 6,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes("selectedRegionIds"))).toBe(true);
  });
});

describe("dataset create and replace schemas", () => {
  it("requires a PGAC or PGIC classification on dataset create", () => {
    expect(
      createDatasetSchema.safeParse({
        fileName: "customers.csv",
        blobPath: "datasets/csv/customers.csv",
        sizeBytes: 100,
        columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
      }).success,
    ).toBe(false);

    expect(
      createDatasetSchema.safeParse({
        fileName: "customers.csv",
        blobPath: "datasets/csv/customers.csv",
        sizeBytes: 100,
        columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
        classification: "PGAC",
      }).success,
    ).toBe(true);
  });

  it("requires a PGAC or PGIC classification on dataset replace", () => {
    expect(
      replaceDatasetSchema.safeParse({
        blobPath: "datasets/csv/customers.csv",
        sizeBytes: 100,
        columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("apiConnectionCreateSchema", () => {
  const basePayload = {
    name: "People API",
    description: "",
    method: "GET",
    url: "https://api.example.com/people",
    headers: [
      {
        name: "Authorization",
        value: "Bearer token",
        isSecret: true,
      },
    ],
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "data.items",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "people.csv",
    datasetClassification: "PGAC",
  };

  it("accepts a generic REST connection", () => {
    expect(apiConnectionCreateSchema.safeParse(basePayload).success).toBe(true);
  });

  it("rejects duplicate headers", () => {
    const result = apiConnectionCreateSchema.safeParse({
      ...basePayload,
      headers: [
        { name: "Authorization", value: "Bearer one", isSecret: true },
        { name: "authorization", value: "Bearer two", isSecret: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires a target dataset for replacement imports", () => {
    const result = apiConnectionCreateSchema.safeParse({
      ...basePayload,
      importMode: "replace",
      targetDatasetId: null,
    });

    expect(result.success).toBe(false);
  });
});
