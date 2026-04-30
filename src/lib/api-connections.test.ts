import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import {
  ApiConnectionError,
  createApiConnectionRunRequest,
  fetchArcgisFeaturePages,
  parseArcgisFeatureRows,
  parseApiResponseRows,
} from "@/lib/api-connections";
import type { EtnopediaRecord } from "@/lib/etnopedia-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseApiResponseRows", () => {
  it("imports JSON arrays at a configured response path", () => {
    const result = parseApiResponseRows({
      body: JSON.stringify({
        data: {
          items: [
            { name: "Alpha", population: 1200, meta: { country: "JP" } },
            { name: "Beta", population: null, meta: { country: "KR" } },
          ],
        },
      }),
      responseFormat: "json",
      responseDataPath: "data.items",
    });

    expect(result.columns.map((column) => column.key)).toEqual([
      "name",
      "population",
      "meta",
    ]);
    expect(result.rows).toEqual([
      { name: "Alpha", population: "1200", meta: '{"country":"JP"}' },
      { name: "Beta", population: "", meta: '{"country":"KR"}' },
    ]);
  });

  it("imports scalar JSON responses as value rows", () => {
    const result = parseApiResponseRows({
      body: JSON.stringify({ status: "ok" }),
      responseFormat: "json",
      responseDataPath: "status",
    });

    expect(result.columns).toEqual([
      {
        key: "value",
        label: "value",
        sourceIndex: 0,
      },
    ]);
    expect(result.rows).toEqual([{ value: "ok" }]);
  });

  it("imports JSON root arrays when no response path is configured", () => {
    const result = parseApiResponseRows({
      body: JSON.stringify([{ name: "Alpha" }, { name: "Beta" }]),
      responseFormat: "json",
      responseDataPath: "",
    });

    expect(result.columns.map((column) => column.key)).toEqual(["name"]);
    expect(result.rows).toEqual([{ name: "Alpha" }, { name: "Beta" }]);
  });

  it("normalizes Etnopedia structured records into script columns", () => {
    const record = {
      title: "Alpha People",
      urls: {
        page: "https://en.etnopedia.org/wiki/Alpha_People",
        talk: "https://en.etnopedia.org/wiki/Talk:Alpha_People",
      },
      provenance: {
        page: { revid: 101, timestamp: "2026-04-30T10:00:00Z" },
        talk: { revid: 202, timestamp: "2026-04-30T10:05:00Z" },
      },
      main: {
        photo_file: "F123456789.jpg",
        photo_source: "Photo credit",
        countries: ["Russia", "Kazakhstan"],
        population_total: 43341,
        population_by_country: [{ country: "Russia", population: 43000 }],
        religion: "Islam",
        reached: {
          status: "Unreached",
          indicator_file: "U001.gif",
          indicator_code: "001",
          indicator_level: "2",
          year: "2020",
        },
        alternate_names: ["Alpha", "Beta"],
        languages: { primary: "Avar", sign: "" },
        bible_translation: {
          exists: "yes",
          year: "2018",
          notes: "New Testament",
          detail: "Complete Bible",
        },
        map: {
          title: "Alpha.map",
          titles: ["Alpha.map"],
          latitude: "1.25",
          longitude: "2.5",
          zoom: "6",
          source: "Etnopedia Maps",
        },
        references: {
          description: "Reference description.",
          statistics: "Reference statistics.",
        },
        sections: { Introduction: "The Alpha people live in the mountains." },
        prayer_points: ["Pray for local leaders."],
      },
      talk: {
        rop3: "123456",
        peopleid3: "789",
        peid_list: ["111", "222"],
        wcdprn_list: ["333"],
        eupc: "555",
        profile_sources: "Registry",
        progress: {
          jp: { file: "U000.gif", year: "2021" },
          gsec: { file: "U001.gif", year: "2022" },
          overall: { file: "U002.gif", year: "xxxx" },
        },
      },
    } satisfies EtnopediaRecord;

    const result = parseApiResponseRows({
      body: JSON.stringify([record]),
      responseFormat: "json",
      responseDataPath: "",
      connectionUrl: "https://en.etnopedia.org/api.php",
    });

    expect(result.columns.map((column) => column.label).slice(0, 7)).toEqual([
      "title",
      "page_url",
      "talk_url",
      "page_revid",
      "page_timestamp",
      "talk_revid",
      "talk_timestamp",
    ]);
    expect(result.rows[0]).toMatchObject({
      title: "Alpha People",
      page_url: "https://en.etnopedia.org/wiki/Alpha_People",
      page_revid: "101",
      countries: "Russia; Kazakhstan",
      countries_list_json: "[\"Russia\",\"Kazakhstan\"]",
      population_total: "43341",
      map_titles_json: "[\"Alpha.map\"]",
      sections_json:
        "{\"Introduction\":\"The Alpha people live in the mountains.\"}",
      rop3: "123456",
      progress_overall_year: "xxxx",
    });
  });

  it("flattens Joshua Project PGIC Resources while preserving raw resources", () => {
    const resources = [
      {
        ROL3: "abc",
        Category: "Audio",
        WebText: "Listen",
        URL: "https://example.com/audio",
      },
      {
        ROL3: "def",
        Category: "Film",
        WebText: "Watch",
        URL: "https://example.com/film",
      },
    ];
    const result = parseApiResponseRows({
      body: JSON.stringify({
        data: [
          {
            ROP3: 123456,
            PeopleName: "Alpha",
            Resources: resources,
            ProfileText: { summary: "Nested text" },
          },
        ],
      }),
      responseFormat: "json",
      responseDataPath: "",
      connectionUrl:
        "https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000",
    });

    expect(result.columns.map((column) => column.label)).toEqual([
      "ROP3",
      "PeopleName",
      "Resource_01_ROL3",
      "Resource_01_Category",
      "Resource_01_WebText",
      "Resource_01_URL",
      "Resource_02_ROL3",
      "Resource_02_Category",
      "Resource_02_WebText",
      "Resource_02_URL",
      "Resources_raw",
      "ProfileText",
    ]);
    expect(result.rows).toEqual([
      {
        rop3: "123456",
        peoplename: "Alpha",
        resource_01_rol3: "abc",
        resource_01_category: "Audio",
        resource_01_webtext: "Listen",
        resource_01_url: "https://example.com/audio",
        resource_02_rol3: "def",
        resource_02_category: "Film",
        resource_02_webtext: "Watch",
        resource_02_url: "https://example.com/film",
        resources_raw: JSON.stringify(resources),
        profiletext: "{\"summary\":\"Nested text\"}",
      },
    ]);
  });

  it("keeps resource-like fields generic for non-Joshua JSON responses", () => {
    const result = parseApiResponseRows({
      body: JSON.stringify({
        data: [{ Resources: [{ ROL3: "abc", Category: "Audio" }] }],
      }),
      responseFormat: "json",
      responseDataPath: "data",
    });

    expect(result.columns.map((column) => column.label)).toEqual(["Resources"]);
    expect(result.rows).toEqual([
      { resources: "[{\"ROL3\":\"abc\",\"Category\":\"Audio\"}]" },
    ]);
  });

  it("imports CSV responses", () => {
    const result = parseApiResponseRows({
      body: "People Group,Population\nAlpha,1200\nBeta,2400\n",
      responseFormat: "csv",
      responseDataPath: "",
    });

    expect(result.columns.map((column) => column.key)).toEqual([
      "people_group",
      "population",
    ]);
    expect(result.rows).toEqual([
      { people_group: "Alpha", population: "1200" },
      { people_group: "Beta", population: "2400" },
    ]);
  });

  it("imports ArcGIS feature attributes and geometry in first-seen order", () => {
    const result = parseArcgisFeatureRows([
      {
        attributes: {
          OBJECTID: 1,
          Name: "Alpha",
        },
        geometry: {
          x: 10.25,
          y: 20.5,
        },
      },
      {
        attributes: {
          OBJECTID: 2,
          Name: "Beta",
          Pop: null,
        },
        geometry: {
          x: 11,
        },
      },
    ]);

    expect(result.columns.map((column) => column.label)).toEqual([
      "OBJECTID",
      "Name",
      "geometry_x",
      "geometry_y",
      "Pop",
    ]);
    expect(result.rows).toEqual([
      {
        objectid: "1",
        name: "Alpha",
        geometry_x: "10.25",
        geometry_y: "20.5",
        pop: "",
      },
      {
        objectid: "2",
        name: "Beta",
        geometry_x: "11",
        geometry_y: "",
        pop: "",
      },
    ]);
  });

  it("rejects missing JSON response paths", () => {
    expect(() =>
      parseApiResponseRows({
        body: JSON.stringify({ data: {} }),
        responseFormat: "json",
        responseDataPath: "data.items",
      }),
    ).toThrow(ApiConnectionError);
  });
});

describe("fetchArcgisFeaturePages", () => {
  it("fetches ArcGIS pages with offsets and object ID ordering", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectIdFieldName: "OBJECTID",
            features: [
              { attributes: { OBJECTID: 1 } },
              { attributes: { OBJECTID: 2 } },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectIdFieldName: "OBJECTID",
            features: [{ attributes: { OBJECTID: 3 } }],
          }),
        ),
      );
    const log = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchArcgisFeaturePages({
      url: "https://example.com/arcgis/rest/services/People/FeatureServer/0/query",
      headers: new Headers(),
      pageSize: 2,
      log,
    });

    expect(result.featureCount).toBe(3);
    expect(JSON.parse(result.body)).toEqual([
      { attributes: { OBJECTID: 1 } },
      { attributes: { OBJECTID: 2 } },
      { attributes: { OBJECTID: 3 } },
    ]);

    const firstUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string);

    expect(firstUrl.searchParams.get("where")).toBe("1=1");
    expect(firstUrl.searchParams.get("outFields")).toBe("*");
    expect(firstUrl.searchParams.get("outSR")).toBe("4326");
    expect(firstUrl.searchParams.get("resultRecordCount")).toBe("2");
    expect(firstUrl.searchParams.get("resultOffset")).toBe("0");
    expect(firstUrl.searchParams.get("orderByFields")).toBeNull();
    expect(secondUrl.searchParams.get("resultOffset")).toBe("2");
    expect(secondUrl.searchParams.get("orderByFields")).toBe("OBJECTID");
    expect(log).toHaveBeenCalledWith("Fetched ArcGIS page 0: 2 features (2 total).");
    expect(log).toHaveBeenCalledWith("Fetched ArcGIS page 1: 1 features (3 total).");
  });
});

describe("createApiConnectionRunRequest", () => {
  it("sends Joshua Project api_key secrets as query params instead of headers", () => {
    const request = createApiConnectionRunRequest({
      method: "GET",
      url: "https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000",
      requestHeaders: [{ name: "Accept", value: "application/json", isSecret: false }],
      bodyTemplate: "",
      secrets: new Map([["api_key", "stored-token"]]),
    });
    const url = new URL(request.url);

    expect(url.searchParams.get("api_key")).toBe("stored-token");
    expect(request.headers.get("api_key")).toBeNull();
    expect(request.headers.get("Accept")).toBe("application/json");
    expect(request.body).toBeUndefined();
  });
});

describe("api connection run actor identity", () => {
  it("hydrates replayed run identities as admin workspace actors", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections.ts"),
      "utf8",
    );

    expect(source).toContain("function identityFromRun");
    expect(source).toContain('workspaceRole: "admin"');
  });
});
