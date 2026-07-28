import { describe, expect, it, vi } from "vitest";

import type { IsoCountryCodeEntry } from "@/lib/iso-country-codes";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

import {
  createReferenceResourceCsvStream,
  listReferenceResourceCatalog,
} from "./index";
import sourceAliasesFixture from "./fixtures/source-aliases.sanitized.json";
import { preparePipelineResource } from "./pipeline-adapters";
import { SOURCE_ALIASES_RESOURCE_KEY } from "./pipeline-types";
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

  it("streams pipeline resource pages with one deterministic typed header", async () => {
    const prepared = preparePipelineResource(
      SOURCE_ALIASES_RESOURCE_KEY,
      sourceAliasesFixture,
    );
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [prepared.entries[0]],
        nextCursor: "cursor-1",
        version: {},
      })
      .mockResolvedValueOnce({
        entries: [prepared.entries[1]],
        nextCursor: null,
        version: {},
      });
    const stream = createReferenceResourceCsvStream(
      { resourceKey: SOURCE_ALIASES_RESOURCE_KEY, search: "example" },
      { query: query as never },
    );
    const csv = await new Response(stream).text();

    expect(csv.match(/Stable key/g)).toHaveLength(1);
    expect(csv).toContain("source:im");
    expect(csv).toContain("source:jp");
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "cursor-1" }),
    );
  });
});

describe("reference resource catalog", () => {
  it("replaces a stale stored route with the canonical resource detail route", async () => {
    getDbMock
      .mockReturnValueOnce({
        select: () => ({
          from: () => ({
            orderBy: async () => [
              {
                id: "resource-id",
                resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
                resourceKind: "pipeline",
                label: "Dataset source aliases",
                description: "Aliases",
                routePath: "/dashboard/resources",
                sortOrder: 3,
                activeVersionId: null,
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: async () => [],
            }),
          }),
        }),
      });

    const catalog = await listReferenceResourceCatalog();

    expect(catalog[0]?.routePath).toBe(
      "/dashboard/resources/source-aliases",
    );
  });
});
