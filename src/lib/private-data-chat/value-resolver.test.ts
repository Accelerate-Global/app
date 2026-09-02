import { describe, expect, it, vi } from "vitest";

import {
  getGeneratedIsoCountryCodeResource,
  type IsoCountryCodeEntry,
} from "@/lib/iso-country-codes";
import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";
import {
  PrivateDataChatValueResolutionError,
  resolvePrivateDataChatQueryValues,
} from "@/lib/private-data-chat/value-resolver";

function country(
  displayName: string,
  primaryAlpha3: string,
  overrides: Partial<IsoCountryCodeEntry> = {},
): IsoCountryCodeEntry {
  return {
    displayName,
    active: true,
    primaryAlpha3,
    officialIsoAlpha2: null,
    officialIsoAlpha3: primaryAlpha3,
    officialIsoNumeric: null,
    untermEnglishShortName: null,
    untermEnglishFormalName: null,
    untermNameSource: null,
    gencAlpha2: null,
    gencAlpha3: null,
    gencNumeric: null,
    fips: null,
    rog3: null,
    alternativeNames: [],
    classification: "iso-official",
    sourceUri: null,
    ...overrides,
  };
}

const version = {
  id: "ad000001-1337-403d-8eb5-b7c44a1be131",
  versionNumber: 8,
  contentChecksum: "country-checksum",
};

const entries = [
  country("United States", "USA", {
    officialIsoAlpha2: "US",
    fips: "US",
    alternativeNames: ["United States of America", "U.S.A."],
  }),
  country("Côte d’Ivoire", "CIV", {
    officialIsoAlpha2: "CI",
    alternativeNames: ["Ivory Coast"],
  }),
  country("Republic of the Congo", "COG", {
    alternativeNames: ["Congo"],
  }),
  country("Democratic Republic of the Congo", "COD", {
    alternativeNames: ["Congo"],
  }),
];

function recordsQuery(countryValue: string | string[]) {
  return {
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
    dataset: "primary_people_groups" as const,
    mode: "records" as const,
    fields: ["people_id" as const],
    filters: [
      {
        field: "country" as const,
        operator: Array.isArray(countryValue) ? ("in" as const) : ("eq" as const),
        value: countryValue,
      },
    ],
    namedFilters: [],
    sort: [],
    limit: 25,
  };
}

describe("private data chat controlled value resolution", () => {
  it("does not load a resource when the plan has no controlled value", async () => {
    const loadCountryValues = vi.fn();
    const query = {
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups" as const,
      mode: "aggregate" as const,
      metrics: ["people_group_count" as const],
      dimensions: [],
      filters: [{ field: "frontier_group" as const, operator: "eq" as const, value: true }],
      namedFilters: [],
      sort: [],
      limit: 1,
    };

    await expect(
      resolvePrivateDataChatQueryValues(query, { loadCountryValues }),
    ).resolves.toEqual({ status: "resolved", query, valueBindings: [] });
    expect(loadCountryValues).not.toHaveBeenCalled();
  });

  it("canonicalizes exact approved names, aliases, and codes with lineage", async () => {
    const resolution = await resolvePrivateDataChatQueryValues(
      recordsQuery(["US", "Cote-d Ivoire"]),
      { loadCountryValues: async () => ({ entries, version }) },
    );

    expect(resolution).toMatchObject({ status: "resolved" });
    if (resolution.status !== "resolved") return;
    expect(resolution.query.filters[0]).toMatchObject({
      value: ["United States", "Côte d’Ivoire"],
    });
    expect(resolution.valueBindings).toEqual([
      {
        field: "country",
        filterIndex: 0,
        resourceKey: "country-territory-codes",
        resourceVersionId: version.id,
        resourceVersionNumber: 8,
        resourceContentChecksum: "country-checksum",
      },
    ]);
    expect(JSON.stringify(resolution.valueBindings)).not.toContain("United States");
  });

  it("clarifies an exact normalized alias with multiple approved matches", async () => {
    const resolution = await resolvePrivateDataChatQueryValues(
      recordsQuery("Congo"),
      { loadCountryValues: async () => ({ entries, version }) },
    );

    expect(resolution).toEqual({
      status: "clarify",
      question:
        "That country value matches more than one approved country (Democratic Republic of the Congo, Republic of the Congo). Which country did you mean?",
      reason: "The approved country reference has more than one exact normalized match.",
    });
  });

  it("resolves the generated catalog's exact Congo display name without inventing ambiguity", async () => {
    const generated = getGeneratedIsoCountryCodeResource();
    const resolution = await resolvePrivateDataChatQueryValues(
      recordsQuery("Congo"),
      {
        loadCountryValues: async () => ({
          entries: generated.entries,
          version,
        }),
      },
    );

    expect(resolution).toMatchObject({
      status: "resolved",
      query: { filters: [{ value: "Congo" }] },
    });
  });

  it("preserves unknown and adversarial country values as inert data", async () => {
    const attack = "Thailand'; DROP TABLE datasets; --";
    const resolution = await resolvePrivateDataChatQueryValues(
      recordsQuery(attack),
      { loadCountryValues: async () => ({ entries, version }) },
    );

    expect(resolution).toMatchObject({
      status: "resolved",
      query: { filters: [{ value: attack }] },
      valueBindings: [],
    });
  });

  it("fails closed when the active country resource cannot be loaded", async () => {
    await expect(
      resolvePrivateDataChatQueryValues(recordsQuery("US"), {
        loadCountryValues: async () => {
          throw new Error("provider details");
        },
      }),
    ).rejects.toBeInstanceOf(PrivateDataChatValueResolutionError);
  });

  it("resolves reviewed ROP names to canonical bound-query values with version lineage", async () => {
    const loadCountryValues = vi.fn();
    const query = {
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups" as const,
      mode: "records" as const,
      fields: ["people_id" as const, "rop2_code" as const],
      filters: [
        { field: "rop2_code" as const, operator: "eq" as const, value: "Cluster" },
        { field: "rop_geography" as const, operator: "eq" as const, value: "SDN" },
      ],
      namedFilters: [],
      sort: [],
      limit: 25,
    };
    const ropVersion = {
      id: "bd000001-1337-403d-8eb5-b7c44a1be131",
      versionNumber: 4,
      contentChecksum: "b".repeat(64),
    };
    const resolution = await resolvePrivateDataChatQueryValues(query, {
      loadCountryValues,
      loadRopValues: async () => ({
        version: ropVersion,
        payload: {
          entries: [
            {
              rop2: { code: "12", name: "Cluster", display: "12 — Cluster" },
              status: "Active",
              place: null,
              language: null,
              source: null,
              joinIssue: null,
              joinIssueLabel: null,
            },
          ],
          geoIndexByRop3: {
            "119434": [
              { geoName: "Sudan", isoAlpha3: "SDN", rog: "AFR" },
            ],
          },
        },
      } as never),
    });

    expect(resolution).toMatchObject({
      status: "resolved",
      query: {
        filters: [{ value: "12" }, { value: "SDN" }],
      },
      valueBindings: [
        { field: "rop2_code", resourceKey: "rop-codes", resourceVersionId: ropVersion.id },
        { field: "rop_geography", resourceKey: "rop-codes", resourceVersionId: ropVersion.id },
      ],
    });
    expect(loadCountryValues).not.toHaveBeenCalled();
  });

  it("canonicalizes a country name used as ROP geography to the reviewed ISO code", async () => {
    const query = {
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups" as const,
      mode: "records" as const,
      fields: ["people_id" as const],
      filters: [
        {
          field: "rop_geography" as const,
          operator: "eq" as const,
          value: "Sudan",
        },
      ],
      namedFilters: [],
      sort: [],
      limit: 25,
    };
    const ropVersion = {
      id: "bd000002-1337-403d-8eb5-b7c44a1be131",
      versionNumber: 4,
      contentChecksum: "c".repeat(64),
    };
    const resolution = await resolvePrivateDataChatQueryValues(query, {
      loadCountryValues: async () => ({
        entries: [country("Sudan", "SDN", { fips: "SU" })],
        version,
      }),
      loadRopValues: async () => ({
        version: ropVersion,
        payload: {
          entries: [],
          geoIndexByRop3: {
            "100090": [
              { geoName: "Afitti", isoAlpha3: "SDN", rog: "SU" },
            ],
          },
        },
      } as never),
    });

    expect(resolution).toMatchObject({
      status: "resolved",
      query: { filters: [{ value: "SDN" }] },
      valueBindings: [
        {
          field: "rop_geography",
          resourceKey: "country-territory-codes",
          resourceVersionId: version.id,
        },
        {
          field: "rop_geography",
          resourceKey: "rop-codes",
          resourceVersionId: ropVersion.id,
        },
      ],
    });
  });
});
