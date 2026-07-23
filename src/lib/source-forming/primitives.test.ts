import { describe, expect, it } from "vitest";

import {
  convertSourceValue,
  createCountryReferenceIndex,
  createRopReferenceIndex,
  createStableSourceRowKey,
  extractSingleScalarIdentifier,
  groupDuplicateIndexes,
  normalizeAccentPunctuationInsensitiveLookup,
  normalizeExactLookup,
  resolveCountryReference,
} from "./primitives";
import {
  SOURCE_FORMING_COUNTRIES,
  SOURCE_FORMING_ROP_ENTRIES,
} from "./fixtures";

describe("source-forming primitives", () => {
  it("uses deterministic NFKC exact lookup without fuzzy matching", () => {
    expect(normalizeExactLookup("  Ａlpha\tGROUP  ")).toBe("alpha group");
    expect(normalizeExactLookup("Cote d Ivoire")).not.toBe(
      normalizeExactLookup("Côte d’Ivoire"),
    );
    expect(normalizeAccentPunctuationInsensitiveLookup("Côte d’Ivoire")).toBe(
      "cote d ivoire",
    );
  });

  it.each([
    ["string", "  Alpha  ", "Alpha"],
    ["identifier", "  00123 ", "00123"],
    ["integer", " 1,234 ", "1234"],
    ["double", " 1,234.50 ", "1234.5"],
    ["boolean", "Engaged", "TRUE"],
    ["boolean", "No", "FALSE"],
    ["datetime", "2026-07-22T10:20:30-07:00", "2026-07-22T17:20:30.000Z"],
    ["datetime", "2026-07-22", "2026-07-22T00:00:00.000Z"],
  ] as const)("converts %s values", (type, raw, expected) => {
    expect(convertSourceValue(type, raw)).toEqual({
      value: expected,
      valid: true,
      blank: false,
    });
  });

  it("rejects invalid typed values without inventing output", () => {
    expect(convertSourceValue("integer", "12.5")).toEqual({
      value: "",
      valid: false,
      blank: false,
    });
    expect(convertSourceValue("boolean", "probably").valid).toBe(false);
    expect(convertSourceValue("datetime", "07/22/2026").valid).toBe(false);
  });

  it("resolves only exact country aliases and supports the bounded WCD normalization", () => {
    const index = createCountryReferenceIndex(SOURCE_FORMING_COUNTRIES);
    expect(
      resolveCountryReference({
        sourceIso3: "",
        sourceCountryName: "US",
        policy: {
          countryOutputField: "Geo_Country_Name",
          iso3OutputField: "Geo_ISO3",
          aliasNormalization: "nfkc",
          allowMultiCountryText: false,
        },
        index,
      }),
    ).toMatchObject({
      status: "resolved",
      iso3: "USA",
      countryName: "United States",
    });
    expect(
      resolveCountryReference({
        sourceIso3: "",
        sourceCountryName: "Cote-d Ivoire",
        policy: {
          countryOutputField: "Geo_Country_Name",
          iso3OutputField: "Geo_ISO3",
          aliasNormalization: "accent-punctuation-insensitive",
          allowMultiCountryText: false,
        },
        index,
      }),
    ).toMatchObject({
      status: "resolved",
      iso3: "CIV",
      countryName: "Côte d’Ivoire",
    });
    expect(
      resolveCountryReference({
        sourceIso3: "",
        sourceCountryName: "United State",
        policy: {
          countryOutputField: "Geo_Country_Name",
          iso3OutputField: "Geo_ISO3",
          aliasNormalization: "nfkc",
          allowMultiCountryText: false,
        },
        index,
      }).status,
    ).toBe("unresolved");
  });

  it("detects exact ROP hierarchy conflicts", () => {
    const conflict = {
      ...SOURCE_FORMING_ROP_ENTRIES[0]!,
      rop1Code: "A999",
    };
    const index = createRopReferenceIndex([
      ...SOURCE_FORMING_ROP_ENTRIES,
      conflict,
    ]);
    expect(index.byRop3.get("100001")?.rop1Code).toBe("A001");
    expect(index.conflictingRop3.has("100001")).toBe(true);
  });

  it("builds stable normalized source keys and groups every duplicate member", () => {
    expect(
      createStableSourceRowKey({
        sourceProfileKey: " Etnopedia-People-Groups ",
        selector: "Title",
        sourceIdentifier: " Ａlpha  People ",
      }),
    ).toBe("etnopedia-people-groups:title:alpha people");
    expect([...groupDuplicateIndexes(["a", "b", "a", "a"])]).toEqual([
      ["a", [0, 2, 3]],
    ]);
  });

  it("accepts only one scalar PEID from Etnopedia evidence", () => {
    expect(extractSingleScalarIdentifier('["42"]')).toEqual({
      value: "42",
      scalar: true,
    });
    expect(extractSingleScalarIdentifier('["42","43"]')).toEqual({
      value: "",
      scalar: false,
    });
  });
});
