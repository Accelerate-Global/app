import { describe, expect, it } from "vitest";

import {
  PrivateDataChatQueryPolicyError,
  compilePrivateDataChatQuery,
} from "@/lib/private-data-chat/compiler";

describe("compilePrivateDataChatQuery", () => {
  it("compiles grouped metrics using only positional parameters", () => {
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "aggregate",
      metrics: ["total_population"],
      dimensions: ["country"],
      filters: [
        { field: "frontier_group", operator: "eq", value: true },
        { field: "population", operator: "gte", value: 5_000 },
      ],
      sort: [{ field: "total_population", direction: "desc" }],
      limit: 25,
    });

    expect(compiled.text).toContain(
      "FROM analytics_ro.primary_people_groups AS p",
    );
    expect(compiled.text).toContain('p."frontier_group" = $1');
    expect(compiled.text).toContain('p."population" >= $2');
    expect(compiled.text).toContain('GROUP BY p."country"');
    expect(compiled.text).toContain('ORDER BY "total_population" DESC');
    expect(compiled.text).toContain("LIMIT $3");
    expect(compiled.parameters).toEqual([true, 5_000, 25]);
  });

  it("keeps adversarial values entirely outside SQL text", () => {
    const attack = "Thailand'; DROP TABLE datasets; --";
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id", "people_name"],
      filters: [{ field: "country", operator: "eq", value: attack }],
      sort: [{ field: "people_id", direction: "asc" }],
      limit: 100,
    });

    expect(compiled.text).not.toContain(attack);
    expect(compiled.text).not.toMatch(/DROP TABLE/i);
    expect(compiled.parameters).toEqual([attack, 100]);
  });

  it("compiles empty-result filters instead of refusing them", () => {
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id"],
      filters: [{ field: "country", operator: "eq", value: "Antarctica" }],
      sort: [],
      limit: 100,
    });

    expect(compiled.parameters).toEqual(["Antarctica", 100]);
    expect(compiled.text).toContain('ORDER BY "people_id" ASC');
  });

  it("uses typed arrays for in filters", () => {
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "aggregate",
      metrics: ["people_group_count"],
      dimensions: ["country"],
      filters: [
        { field: "country", operator: "in", value: ["India", "Nepal"] },
      ],
      sort: [],
      limit: 10,
    });

    expect(compiled.text).toContain('p."country" = ANY($1::text[])');
    expect(compiled.parameters).toEqual([["India", "Nepal"], 10]);
  });

  it("rejects sorting by an unselected semantic key", () => {
    expect(() =>
      compilePrivateDataChatQuery({
        dataset: "primary_people_groups",
        mode: "records",
        fields: ["people_id"],
        filters: [],
        sort: [{ field: "country", direction: "desc" }],
        limit: 10,
      }),
    ).toThrow(PrivateDataChatQueryPolicyError);
  });
});
