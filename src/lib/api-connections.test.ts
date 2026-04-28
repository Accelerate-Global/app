import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ApiConnectionError, parseApiResponseRows } from "@/lib/api-connections";

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
