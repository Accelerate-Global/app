import { describe, expect, it } from "vitest";

import { getGeneratedIsoCountryCodeResource } from "@/lib/iso-country-codes";
import { getGeneratedRopCodeResource } from "@/lib/rop-codes";

import {
  diffReferenceResources,
  getCountryStableKey,
  prepareReferenceResource,
} from "./adapters";
import { checksumReferenceResource } from "./canonical";
import { COUNTRY_RESOURCE_KEY, ROP_RESOURCE_KEY } from "./types";

describe("reference resource adapters", () => {
  it("projects every generated Country/ROG entry with stable search and CSV parity", () => {
    const resource = getGeneratedIsoCountryCodeResource();
    const prepared = prepareReferenceResource(COUNTRY_RESOURCE_KEY, resource);

    expect(prepared.entryCount).toBe(273);
    expect(prepared.countryEntries).toHaveLength(273);
    expect(prepared.stableEntries.size).toBe(273);
    expect(prepared.countryEntries.find((entry) => entry.stableKey === "iso:code:3166:AF:afghanistan")).toMatchObject({
      rog3: "AF",
      fips: "AF",
    });
    expect(prepared.csv.split("\n")[0]).toContain("Alternative names");
    expect(getCountryStableKey(resource.entries[0])).toBe(
      "iso:code:3166:AF:afghanistan",
    );
    expect(checksumReferenceResource(resource)).toBe(
      "9b6f902b7fac52e15003616c51b8bd8c9c55ccf5f365a186efae145897906369",
    );
    expect(resource.entries.filter((entry) => entry.rog3 === null).length).toBeGreaterThan(0);
  });

  it("projects the generated ROP hierarchy, people, geography, search, and CSV", () => {
    const resource = getGeneratedRopCodeResource();
    const prepared = prepareReferenceResource(ROP_RESOURCE_KEY, resource);

    expect(prepared.entryCount).toBe(13_069);
    expect(prepared.ropPeople).toHaveLength(13_069);
    expect(prepared.ropTerms).toHaveLength(17 + 292 + 9_015 + 13_065);
    expect(prepared.ropGeographies).toHaveLength(21_418);
    expect(prepared.ropPeople.find((entry) => entry.stableKey === "rop3-100425")?.searchText)
      .toContain("saudi arabia");
    expect(prepared.csv.split("\n")[0]).toBe(
      "ROP1,ROP2,ROP25,ROP3,Status,Row type,Join issue,Place,Language,Source,Ethnic ID",
    );
    expect(resource.joinIssueCounts).toEqual({
      "missing-rop25": 121,
      "parent-only-rop25": 4,
      "rop2-conflict": 1,
    });
    expect(resource.rop3DetailsByCode["100425"]).toMatchObject({ code: "100425" });
    expect(resource.geoIndexByRop3["100425"].length).toBeGreaterThan(0);
    expect(checksumReferenceResource(resource)).toBe(
      "7772f46db9391489866b8a042a7c61493e2a6dabf61d84b2524e9b91263b3f6a",
    );
  });

  it("blocks duplicate country keys and malformed ROP parent/detail packages", () => {
    const country = getGeneratedIsoCountryCodeResource();
    expect(() =>
      prepareReferenceResource(COUNTRY_RESOURCE_KEY, {
        ...country,
        entryCount: country.entryCount + 1,
        activeCount: country.activeCount + (country.entries[0].active ? 1 : 0),
        entries: [...country.entries, country.entries[0]],
      }),
    ).toThrow(/duplicate stable entry keys/u);

    const rop = getGeneratedRopCodeResource();
    const [first, ...rest] = rop.entries;
    expect(() =>
      prepareReferenceResource(ROP_RESOURCE_KEY, {
        ...rop,
        entries: [{ ...first, rop1: null }, ...rest],
      }),
    ).toThrow(/missing its ROP1 parent/u);
    expect(() =>
      prepareReferenceResource(ROP_RESOURCE_KEY, {
        ...rop,
        rop3DetailsByCode: { ...rop.rop3DetailsByCode, [first.rop3!.code]: undefined } as never,
      }),
    ).toThrow(/term/u);
  });

  it("produces deterministic added, changed, removed, and high-risk diffs", () => {
    const resource = getGeneratedIsoCountryCodeResource();
    const previous = { ...resource, entries: resource.entries.slice(0, 2), entryCount: 2 };
    const next = {
      ...resource,
      entries: [
        {
          ...resource.entries[0],
          alternativeNames: [...resource.entries[0].alternativeNames, "Changed alias"],
        },
        resource.entries[2],
      ],
      entryCount: 2,
    };
    const diff = diffReferenceResources({
      resourceKey: COUNTRY_RESOURCE_KEY,
      previous,
      next,
    });
    expect(diff.summary).toEqual({
      added: 1,
      changed: 1,
      removed: 1,
      unchanged: 0,
      highRisk: 1,
    });
  });
});
