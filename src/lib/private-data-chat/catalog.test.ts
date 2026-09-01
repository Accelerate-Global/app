import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_CATALOG,
  PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  PRIVATE_DATA_CHAT_FIELDS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
  PRIVATE_DATA_CHAT_SYNONYMS,
  PRIVATE_DATA_CHAT_VIEW,
  buildPrivateDataChatPlannerCatalogContext,
  calculatePrivateDataChatCatalogChecksum,
  getPrivateDataChatAnswerSemanticContext,
  getPrivateDataChatCatalogReconciliationFindings,
} from "@/lib/private-data-chat/catalog";

describe("private data chat catalog", () => {
  it("binds the reviewed semantic snapshot to its exact checksum revision", () => {
    expect(calculatePrivateDataChatCatalogChecksum()).toBe(
      PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
    );
    expect(PRIVATE_DATA_CHAT_CATALOG_VERSION).toBe(
      `primary-people-groups-v3.${PRIVATE_DATA_CHAT_CATALOG_CHECKSUM.slice(0, 12)}`,
    );
    expect(PRIVATE_DATA_CHAT_CATALOG.joinCapabilities).toEqual([
      "people_group_to_bound_rop3",
    ]);
  });

  it("maps every approved use to complete semantic and compiler metadata", () => {
    for (const key of PRIVATE_DATA_CHAT_FILTER_KEYS) {
      const field = PRIVATE_DATA_CHAT_CATALOG.fields[key];
      expect(field.column).toMatch(/^[a-z0-9_]+$/);
      expect(field.description.length).toBeGreaterThan(20);
      expect(field.aliases.length).toBeGreaterThan(0);
      expect(field.nullMeaning.length).toBeGreaterThan(10);
      expect(field.provenance.canonicalFieldDefinitionKeys.length).toBeGreaterThan(
        0,
      );
      expect(field.uses).toContain("filter");
    }

    for (const key of PRIVATE_DATA_CHAT_DIMENSION_KEYS) {
      expect(PRIVATE_DATA_CHAT_FIELDS[key].uses).toEqual(
        expect.arrayContaining(["dimension", "record"]),
      );
    }

    for (const key of PRIVATE_DATA_CHAT_METRIC_KEYS) {
      const metric = PRIVATE_DATA_CHAT_CATALOG.metrics[key];
      expect(metric.expression).not.toContain("$");
      expect(metric.semanticFormula.length).toBeGreaterThan(20);
      expect(metric.compatibleDimensions).toEqual(PRIVATE_DATA_CHAT_DIMENSION_KEYS);
    }
  });

  it("reconciles cited source contracts and derives aliases without widening access", () => {
    expect(getPrivateDataChatCatalogReconciliationFindings()).toEqual([]);
    expect(PRIVATE_DATA_CHAT_SYNONYMS["nation"]).toBe("country");
    expect(PRIVATE_DATA_CHAT_SYNONYMS["number of people groups"]).toBe(
      "people_group_count",
    );
    expect(PRIVATE_DATA_CHAT_FILTER_KEYS).not.toContain("geo_continent_name");
  });

  it("renders safe planner context without compiler-only mappings", () => {
    const context = buildPrivateDataChatPlannerCatalogContext();

    expect(context).toContain(PRIVATE_DATA_CHAT_CATALOG_VERSION);
    expect(context).toContain("One row per current primary people-group record");
    expect(context).toContain("null is not zero");
    expect(context).toContain(
      "Approved relationship: people_group_to_bound_rop3",
    );
    expect(context).toContain("Physical or unregistered joins remain unavailable");
    expect(context).not.toContain(PRIVATE_DATA_CHAT_VIEW);
    expect(context).not.toContain("count(*)");
    expect(context).not.toContain("Geo_Country_Name");
    expect(context).not.toContain("PG_Population");
    expect(context).not.toContain("field_definitions");
  });

  it("returns answer context only for selected safe semantic concepts", () => {
    const context = getPrivateDataChatAnswerSemanticContext([
      "country",
      "total_population",
      "country",
    ]);

    expect(context.concepts.map((concept) => concept.key)).toEqual([
      "country",
      "total_population",
    ]);
    expect(JSON.stringify(context)).not.toContain("Percent evangelical");
    expect(JSON.stringify(context)).not.toContain(PRIVATE_DATA_CHAT_VIEW);
    expect(JSON.stringify(context)).not.toContain("sum(p.population)");
  });
});
