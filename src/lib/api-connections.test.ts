import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import {
  ApiConnectionError,
  createApiConnectionRunRequest,
  extractApiConnectionResources,
  fetchArcgisFeaturePages,
  getInitialDatasetWorkspaceVisibility,
  listCodeManagedApiConnections,
  normalizeGoogleSheetsDatasetSettings,
  parseArcgisFeatureRows,
  parseApiResponseRows,
  resolveGoogleSheetsConnectionTab,
} from "@/lib/api-connections";
import type { GoogleSheetsConnectionProviderConfig } from "@/lib/api-types";
import type { EtnopediaRecord } from "@/lib/etnopedia-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeGoogleSheetsDatasetSettings", () => {
  it("sanitizes one reviewed name per selected tab", () => {
    expect(
      Object.fromEntries(
        normalizeGoogleSheetsDatasetSettings({
          selectedSheetIds: [1, 2],
          datasetSettings: [
            { sheetId: 1, datasetName: "Reviewed Alpha" },
            { sheetId: 2, datasetName: "Reviewed / Beta" },
          ],
        }) ?? [],
      ),
    ).toEqual({ 1: "Reviewed-Alpha", 2: "Reviewed-Beta" });
  });

  it("preserves legacy omission and rejects incomplete or duplicate settings", () => {
    expect(
      normalizeGoogleSheetsDatasetSettings({ selectedSheetIds: [1] }),
    ).toBeNull();
    expect(() =>
      normalizeGoogleSheetsDatasetSettings({
        selectedSheetIds: [1, 2],
        datasetSettings: [{ sheetId: 1, datasetName: "People" }],
      }),
    ).toThrow("Choose one unique dataset name");
    expect(() =>
      normalizeGoogleSheetsDatasetSettings({
        selectedSheetIds: [1, 2],
        datasetSettings: [
          { sheetId: 1, datasetName: "People" },
          { sheetId: 2, datasetName: "people" },
        ],
      }),
    ).toThrow("Choose one unique dataset name");
  });
});

describe("listCodeManagedApiConnections", () => {
  it("exposes the repo-owned API connections without committed secret values", () => {
    const connections = listCodeManagedApiConnections();

    expect(connections.map((connection) => connection.name)).toEqual([
      "IMB (People Groups)",
      "Etnopedia",
      "Joshua Project (PGIC)",
    ]);
    expect(connections.map((connection) => connection.id)).toEqual([
      "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
      "6f9f6ef2-1188-4f71-9c24-ef01debf7a02",
      "6f9f6ef2-1188-4f71-9c24-ef01debf7a03",
    ]);
    expect(connections[2]?.headers).toEqual([
      { name: "api_key", value: "", isSecret: true },
    ]);
    expect(connections[0]?.url).toBe(
      "https://services2.arcgis.com/S4ydGgujXcif36k3/arcgis/rest/services/pIMBPeople/FeatureServer/0/query",
    );
    expect(connections[2]?.url).not.toContain("api_key=");
  });
});

describe("resolveGoogleSheetsConnectionTab", () => {
  const providerConfig: GoogleSheetsConnectionProviderConfig = {
    provider: "google_sheets",
    spreadsheetId: "sheet_123",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    spreadsheetTitle: "Old workbook",
    sheetId: 17,
    sheetTitle: "Old tab title",
    rangeMode: "full_tab",
  };

  it("resolves a renamed tab by stable sheet ID and returns fresh titles", () => {
    expect(
      resolveGoogleSheetsConnectionTab({
        providerConfig,
        metadata: {
          spreadsheetId: "sheet_123",
          spreadsheetTitle: "Renamed workbook",
          sheets: [{ sheetId: 17, title: "Renamed tab", index: 2 }],
        },
      }),
    ).toEqual({
      selectedSheet: { sheetId: 17, title: "Renamed tab", index: 2 },
      spreadsheetTitle: "Renamed workbook",
    });
  });

  it("rejects a deleted stable sheet ID instead of reading another tab", () => {
    expect(() =>
      resolveGoogleSheetsConnectionTab({
        providerConfig,
        metadata: {
          spreadsheetId: "sheet_123",
          spreadsheetTitle: "Workbook",
          sheets: [{ sheetId: 99, title: "Replacement tab", index: 0 }],
        },
      }),
    ).toThrow("Google Sheet tab is not readable by the service account.");
  });
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

describe("extractApiConnectionResources", () => {
  it("extracts valid resource fields, removes URL hashes for dedupe, and skips invalid URLs", () => {
    const resources = extractApiConnectionResources({
      connectionId: "connection-1",
      runId: "run-1",
      rows: [
        {
          resource_01_category: "Audio",
          resource_01_webtext: "Listen",
          resource_01_url: "https://example.com/audio#player",
          resource_02_category: "Film",
          resource_02_webtext: "Watch",
          resource_02_url: "ftp://example.com/film",
          resource_03_category: "Audio",
          resource_03_webtext: "Hear",
          resource_03_url: "https://example.com/audio",
        },
      ],
    });

    expect(resources).toEqual([
      {
        connectionId: "connection-1",
        runId: "run-1",
        resourceUrl: "https://example.com/audio#player",
        normalizedUrl: "https://example.com/audio",
        webText: "Listen",
        sourceRowIndex: 0,
        sourceResourceIndex: 1,
      },
    ]);
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
      fetchSafe: async ({ url, init }) => fetchMock(url, init),
    });

    expect(result.featureCount).toBe(3);
    expect(JSON.parse(result.body)).toEqual([
      { attributes: { OBJECTID: 1 } },
      { attributes: { OBJECTID: 2 } },
      { attributes: { OBJECTID: 3 } },
    ]);

    const firstUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1]![0] as string);
    const thirdUrl = new URL(fetchMock.mock.calls[2]![0] as string);

    expect(firstUrl.searchParams.get("where")).toBe("1=1");
    expect(firstUrl.searchParams.get("outFields")).toBe("*");
    expect(firstUrl.searchParams.get("outSR")).toBe("4326");
    expect(firstUrl.searchParams.get("resultRecordCount")).toBe("2");
    expect(firstUrl.searchParams.get("resultOffset")).toBe("0");
    expect(firstUrl.searchParams.get("orderByFields")).toBeNull();
    expect(secondUrl.searchParams.get("resultOffset")).toBe("0");
    expect(secondUrl.searchParams.get("orderByFields")).toBe("OBJECTID");
    expect(thirdUrl.searchParams.get("resultOffset")).toBe("2");
    expect(thirdUrl.searchParams.get("orderByFields")).toBe("OBJECTID");
    expect(log).toHaveBeenCalledWith(
      "Discovered ArcGIS object ID field OBJECTID; refetching page zero in stable order.",
    );
    expect(log).toHaveBeenCalledWith("Fetched ArcGIS page 0: 2 features (2 total).");
    expect(log).toHaveBeenCalledWith("Fetched ArcGIS page 1: 1 features (3 total).");
  });

  it("continues from the actual row count when ArcGIS clamps a page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectIdFieldName: "OBJECTID",
            exceededTransferLimit: true,
            features: [{ attributes: { OBJECTID: 1 } }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectIdFieldName: "OBJECTID",
            exceededTransferLimit: true,
            features: [{ attributes: { OBJECTID: 1 } }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            objectIdFieldName: "OBJECTID",
            features: [{ attributes: { OBJECTID: 2 } }],
          }),
        ),
      );

    const result = await fetchArcgisFeaturePages({
      url: "https://example.com/arcgis/rest/services/People/FeatureServer/0/query",
      headers: new Headers(),
      pageSize: 2,
      fetchSafe: async ({ url, init }) => fetchMock(url, init),
    });

    expect(result.featureCount).toBe(2);
    expect(
      new URL(fetchMock.mock.calls[2]![0] as string).searchParams.get(
        "resultOffset",
      ),
    ).toBe("1");
  });

  it("rejects a full page when ArcGIS cannot establish stable ordering", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            { attributes: { value: 1 } },
            { attributes: { value: 2 } },
          ],
        }),
      ),
    );

    await expect(
      fetchArcgisFeaturePages({
        url: "https://example.com/arcgis/rest/services/People/FeatureServer/0/query",
        headers: new Headers(),
        pageSize: 2,
        fetchSafe: async ({ url, init }) => fetchMock(url, init),
      }),
    ).rejects.toThrow("stable pagination");
  });
});

describe("api connection run artifact storage", () => {
  it("uploads archived artifacts with the dedicated bucket and bare JSON content type", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(source).toContain(".from(getApiConnectionRunArtifactStorageBucket())");
    expect(source).toContain(
      "new Blob([input.content], { type: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE })",
    );
    expect(source).toContain(
      "contentType: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE",
    );
    expect(source).not.toContain('contentType: "application/json;charset=utf-8"');
  });
});

describe("api connection import snapshots", () => {
  it("archives IMB imports without passing unformed rows into dataset publication", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(source).toContain(
      'run.mode === "import" && connection.id !== IMB_API_CONNECTION_ID',
    );
    expect(source).toContain(
      "Archived IMB source rows for forming; no dataset was published.",
    );
  });

  it("uses the shared CSV cell escaping helper for import snapshot CSV", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/core.ts"),
      "utf8",
    );

    expect(source).toContain('import { escapeCsvCell, normalizeHeaders } from "@/lib/csv";');
    expect(source).toContain("input.columns.map((column) => escapeCsvCell(column.label))");
    expect(source).toContain("input.columns.map((column) => escapeCsvCell(row[column.key] ?? \"\"))");
    expect(source).not.toContain("function escapeCsvCell");
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
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(source).toContain("function identityFromRun");
    expect(source).toContain('workspaceRole: "admin"');
  });
});

describe("Google Sheets provider runs", () => {
  it("uses explicit Google Sheets visibility and defaults legacy connections to visible", () => {
    expect(
      getInitialDatasetWorkspaceVisibility({
        provider: "google_sheets",
        spreadsheetId: "sheet_123",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
        spreadsheetTitle: "Mission Sheet",
        sheetId: 1,
        sheetTitle: "Alpha",
        rangeMode: "full_tab",
        isWorkspaceVisible: false,
      }),
    ).toBe(false);
    expect(
      getInitialDatasetWorkspaceVisibility({
        provider: "google_sheets",
        spreadsheetId: "legacy_sheet",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/legacy_sheet/edit",
        spreadsheetTitle: "Legacy Sheet",
        sheetId: 2,
        sheetTitle: "Legacy Tab",
        rangeMode: "full_tab",
      }),
    ).toBe(true);
    expect(
      getInitialDatasetWorkspaceVisibility({ provider: "http_api" }),
    ).toBe(true);
  });

  it("applies configured visibility only when a run creates its dataset", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );
    const replaceStart = source.indexOf("await replaceDatasetContents({");
    const createStart = source.indexOf(": await createDataset({", replaceStart);
    const persistEnd = source.indexOf("if (!dataset)", createStart);
    const replaceCall = source.slice(replaceStart, createStart);
    const createCall = source.slice(createStart, persistEnd);

    expect(source).toContain("isWorkspaceVisible: input.isWorkspaceVisible");
    expect(replaceCall).not.toContain("getInitialDatasetWorkspaceVisibility");
    expect(createCall).toContain(
      "isWorkspaceVisible: getInitialDatasetWorkspaceVisibility(providerConfig)",
    );
  });

  it("routes Google Sheets connections through the service-account provider adapter", async () => {
    const adapterSource = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/providers/google-sheets.ts"),
      "utf8",
    );
    const orchestratorSource = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(adapterSource).toContain(
      "connection.provider === GOOGLE_SHEETS_PROVIDER",
    );
    expect(adapterSource).toContain("fetchGoogleSheetsConnectionOutput");
    expect(adapterSource).toContain("getGoogleSheetsServiceAccountAccessToken");
    expect(adapterSource).not.toContain("google_refresh_token");
    expect(adapterSource).not.toContain("google_access_token");
    expect(orchestratorSource).toContain(
      "const redactedBody = redactSecrets(body, secrets)",
    );
    expect(orchestratorSource).toContain("await bindGoogleSheetsConnectionTarget");
  });

  it("preserves existing datasets when Google Sheets access, parse, or size checks fail", async () => {
    const orchestratorSource = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );
    const fetchIndex = orchestratorSource.indexOf(
      "const result = await provider.fetch",
    );
    const parseIndex = orchestratorSource.indexOf(
      "parsed ??= provider.parse",
    );
    const persistIndex = orchestratorSource.indexOf(
      "await persistImportedRows",
    );
    const catchIndex = orchestratorSource.indexOf(
      "} catch (error) {",
      persistIndex,
    );

    expect(fetchIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(fetchIndex);
    expect(persistIndex).toBeGreaterThan(parseIndex);
    expect(catchIndex).toBeGreaterThan(persistIndex);
    expect(orchestratorSource).toContain(
      "error instanceof GoogleSheetsError",
    );
    expect(orchestratorSource).toContain("datasetId: null");
    expect(orchestratorSource).toContain(
      "errorMessage: redactSecrets(message, secrets)",
    );
  });

  it("archives connections, resolves stable tab IDs, and blocks disconnected queued runs", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(source).toContain("synchronizeGoogleSheetsConnectionTab");
    expect(source).toContain("isNull(apiConnections.archivedAt)");
    expect(source).toContain('archiveReason: "Disconnected by administrator."');
    expect(source).not.toContain(
      ".delete(apiConnections)\n    .where(eq(apiConnections.id, connection.id))",
    );
    expect(source).toContain(
      'errorMessage: "API connection was disconnected before execution."',
    );
  });

  it("preflights active duplicates and handles concurrent unique conflicts", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/lib/api-connections/index.ts"),
      "utf8",
    );

    expect(source).toContain("const conflicts = selectedSheets.filter");
    expect(source).toContain("Already connected:");
    expect(source).toContain('error.code === "23505"');
    expect(source).toContain("const archived =");
    expect(source).toContain("archivedAt: null");
  });
});
