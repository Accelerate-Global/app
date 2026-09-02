import { describe, expect, it } from "vitest";

import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";
import {
  PrivateDataChatQueryPolicyError,
  compilePrivateDataChatQuery,
} from "@/lib/private-data-chat/compiler";

describe("compilePrivateDataChatQuery", () => {
  it("compiles grouped metrics using only positional parameters", () => {
    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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

  it("compiles the reviewed UUPG named filter from the trusted registry", () => {
    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion:
        PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups",
      mode: "aggregate",
      metrics: ["people_group_count"],
      dimensions: [],
      filters: [],
      namedFilters: [
        {
          key: "uupg",
          version: 1,
          options: {
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: true,
          },
        },
      ],
      sort: [],
      limit: 1,
    });

    expect(compiled.text).toContain('p."globally_engaged" = $1::boolean');
    expect(compiled.text).toContain(
      'p."globally_engaged_is_missing" = true',
    );
    expect(compiled.text).toContain('p."frontier_group" = $2::boolean');
    expect(compiled.parameters).toEqual([false, true, 1]);
    expect(compiled.appliedNamedFilterKeys).toEqual(["uupg"]);
  });

  it("rejects duplicate named-filter applications", () => {
    const namedFilter = {
      key: "uupg" as const,
      version: 1 as const,
      options: {
        globalEngagementAnywhereEnabled: true,
        frontierGroupEnabled: true,
      },
    };

    expect(() =>
      compilePrivateDataChatQuery({
        catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        namedFilterRegistryVersion:
          PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
        dataset: "primary_people_groups",
        mode: "aggregate",
        metrics: ["people_group_count"],
        dimensions: [],
        filters: [],
        namedFilters: [namedFilter, namedFilter],
        sort: [],
        limit: 1,
      }),
    ).toThrow(PrivateDataChatQueryPolicyError);
  });

  it("rejects sorting by an unselected semantic key", () => {
    expect(() =>
      compilePrivateDataChatQuery({
        catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        dataset: "primary_people_groups",
        mode: "records",
        fields: ["people_id"],
        filters: [],
        sort: [{ field: "country", direction: "desc" }],
        limit: 10,
      }),
    ).toThrow(PrivateDataChatQueryPolicyError);
  });

  it("selects the server-owned bound ROP relationship without model-authored join syntax", () => {
    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      dataset: "primary_people_groups",
      mode: "aggregate",
      metrics: ["people_group_count"],
      dimensions: ["rop2_name"],
      filters: [{ field: "rop3_status", operator: "eq", value: "Active" }],
      sort: [{ field: "people_group_count", direction: "desc" }],
      limit: 25,
    });

    expect(compiled.requiresRopBinding).toBe(true);
    expect(compiled.appliedRelationshipKeys).toEqual([
      "people_group_to_bound_rop3",
    ]);
    expect(compiled.text).toContain('p."rop_binding_status" = \'bound\'');
    expect(compiled.text).toContain('p."rop3_status" = $1');
    expect(compiled.text).not.toMatch(/\bJOIN\b/iu);
    expect(compiled.text).not.toContain(" ON ");
    expect(compiled.parameters).toEqual(["Active", 25]);
  });

  it("compiles ROP geography as a grain-preserving array predicate", () => {
    const attack = "Sudan') OR true --";
    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id", "rop3_code"],
      filters: [{ field: "rop_geography", operator: "eq", value: attack }],
      sort: [{ field: "people_id", direction: "asc" }],
      limit: 25,
    });

    expect(compiled.text).toContain(
      '$1::text = ANY(coalesce(p."rop_geographies", \'{}\'::text[]))',
    );
    expect(compiled.text).not.toContain(attack);
    expect(compiled.parameters).toEqual([attack, 25]);
  });

  it("fails closed on a stale catalog revision", () => {
    expect(() =>
      compilePrivateDataChatQuery({
        catalogVersion: "primary-people-groups-v1",
        dataset: "primary_people_groups",
        mode: "aggregate",
        metrics: ["people_group_count"],
        dimensions: [],
        filters: [],
        sort: [],
        limit: 1,
      }),
    ).toThrow(PrivateDataChatQueryPolicyError);
  });
});
