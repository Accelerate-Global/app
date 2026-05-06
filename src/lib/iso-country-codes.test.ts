import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildIsoCountryCodeResource,
  getGeneratedIsoCountryCodeResource,
  refreshIsoCountryCodeResourceFromOfficialSource,
} from "@/lib/iso-country-codes";

function createEntries(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const alpha2 = `A${String.fromCharCode(65 + (index % 26))}`;
    const alpha3 = `A${String(index).padStart(2, "0")}`.slice(0, 3);

    return {
      alpha2,
      alpha3,
      englishShortName: `Country ${String(index).padStart(3, "0")}`,
      numeric: String(index).padStart(3, "0"),
      uri: `iso:code:3166:${alpha2}`,
    };
  }).map((entry, index) => ({
    ...entry,
    alpha2: `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(
      65 + (index % 26),
    )}`,
    alpha3: `${String.fromCharCode(65 + Math.floor(index / 676))}${String.fromCharCode(
      65 + (Math.floor(index / 26) % 26),
    )}${String.fromCharCode(65 + (index % 26))}`,
  }));
}

function toVaadinRows(count: number) {
  return createEntries(count).map((entry, index) => ({
    k: String(index + 1),
    d: {
      "142": "country",
      "144": entry.alpha2,
      "148": entry.englishShortName,
      "162": entry.numeric,
      "164": entry.uri,
      "166": entry.alpha3,
      "176": "Officially assigned",
    },
  }));
}

describe("ISO country codes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the generated country-code resource", () => {
    const resource = getGeneratedIsoCountryCodeResource();

    expect(resource.entryCount).toBeGreaterThanOrEqual(240);
    expect(resource.entries.some((entry) => entry.alpha3 === "AFG")).toBe(true);
  });

  it("rejects duplicate ISO3 entries", () => {
    expect(() =>
      buildIsoCountryCodeResource({
        entries: [
          ...createEntries(240),
          {
            alpha2: "ZZ",
            alpha3: "AAA",
            englishShortName: "Duplicate",
            numeric: "999",
            uri: "iso:code:3166:ZZ",
          },
        ],
      }),
    ).toThrow("Duplicate ISO alpha-3 code");
  });

  it("refreshes from ISO OBP UIDL payloads", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://www.iso.org/obp/ui/") {
        return new Response("<html></html>", {
          headers: { "set-cookie": "JSESSIONID=abc; Path=/obp" },
        });
      }

      if (url.startsWith("https://www.iso.org/obp/ui/?v-")) {
        return Response.json({
          uidl: JSON.stringify({
            "Vaadin-Security-Key": "token-1",
            syncId: 0,
            clientId: 0,
            state: {},
            rpc: [
              [
                "135",
                "com.vaadin.shared.data.DataCommunicatorClientRpc",
                "setData",
                [0, toVaadinRows(240)],
              ],
            ],
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resource = await refreshIsoCountryCodeResourceFromOfficialSource();

    expect(resource.entryCount).toBe(240);
    expect(resource.entries[0]).toMatchObject({
      alpha2: "AA",
      alpha3: "AAA",
      englishShortName: "Country 000",
    });
  });
});
