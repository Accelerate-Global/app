import { describe, expect, it, vi } from "vitest";

import type { IsoCountryCodeEntry } from "@/lib/iso-country-codes";

import { createReferenceResourceCsvStream } from "./index";
import { COUNTRY_RESOURCE_KEY } from "./types";

const entry: IsoCountryCodeEntry = {
  displayName: "Example, Territory",
  active: true,
  primaryAlpha3: "EXT",
  officialIsoAlpha2: null,
  officialIsoAlpha3: null,
  officialIsoNumeric: null,
  untermEnglishShortName: null,
  untermEnglishFormalName: null,
  untermNameSource: null,
  gencAlpha2: "EX",
  gencAlpha3: "EXT",
  gencNumeric: "999",
  fips: "EX",
  rog3: null,
  alternativeNames: ["Exampleland"],
  classification: "genc-supported",
  sourceUri: null,
};

describe("reference resource CSV streaming", () => {
  it("emits one header and cursor-paged rows without buffering the complete export", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ entries: [entry], nextCursor: "cursor-1", version: {} })
      .mockResolvedValueOnce({ entries: [{ ...entry, displayName: "Second" }], nextCursor: null, version: {} });
    const stream = createReferenceResourceCsvStream(
      { resourceKey: COUNTRY_RESOURCE_KEY, search: "example" },
      { query: query as never },
    );
    const csv = await new Response(stream).text();

    expect(csv.match(/Country\/Territory/g)).toHaveLength(1);
    expect(csv).toContain('"Example, Territory"');
    expect(csv).toContain("Second");
    expect(query).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: null, search: "example", limit: 500 }));
    expect(query).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "cursor-1" }));
  });
});
