import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_VIEW,
} from "@/lib/private-data-chat/catalog";
import {
  PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION,
  PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
  PRIVATE_DATA_CHAT_PLANNER_PROMPT_VERSION,
  PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
} from "@/lib/private-data-chat/prompts";

describe("private data chat prompts", () => {
  it("supplies the reviewed semantic catalog and exact revision to planning", () => {
    expect(PRIVATE_DATA_CHAT_PLANNER_PROMPT_VERSION).toBe(
      "people-groups-planner-v23",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      PRIVATE_DATA_CHAT_CATALOG_VERSION,
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toMatch(
      /unweighted average/iu,
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "approved country-territory-codes names, aliases, and codes",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Approved relationship: people_group_to_bound_rop3",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Minimal-plan rules are strict",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "never convert a count-by request into mode=records",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“recorded” describes the values to list and never requests neq null',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Every UUPG options object must contain both boolean properties",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Never add frontier_group or globally_engaged to ordinary filters for any UUPG criterion",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "use average_population by country, limit=50, and sort=[]",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "a ROP field, relationship, geography, or ordinary people-group query never implies UUPG",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "the minimal identifying projection is people_name plus that ranking field",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      'The unqualified word "status" is ambiguous',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Explicit field labels are not ambiguous",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "always means globally_engaged and never engagement_phase",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“Current dataset” states scope and never requests a non-null filter',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Primary religion is not an approved field",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "The approved bound rop_language field is a queryable and groupable dimension",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "A forbidden external-action refusal",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "physical or unregistered joins use decision=clarify",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "use decision=clarify, never decision=answer",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Use eq for one explicit filter value",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "do not suggest a numeric example or default",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "all map exactly to average_population",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“Total recorded population” maps exactly to total_population',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Never add a separate neq-null filter beside a numeric comparison",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“not true” means operator=neq with value=true',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“not globally engaged” and “unengaged”',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "ask which meaning the user wants and name both choices",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Forecasting, prediction, and future or historical time-series requests",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "fields and count are independent required choices",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "which records or prior result the user means",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      '“how many” or “count” always uses operation=count',
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Operation=search always requires a non-null matching query",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "including people_id and people_name",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).toContain(
      "Never clarify, predict an empty result, or claim what the current rows contain",
    );
  });

  it("keeps compiler, provider, and database details outside model context", () => {
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).not.toContain(
      PRIVATE_DATA_CHAT_VIEW,
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).not.toContain("count(*)");
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).not.toContain("auth.users");
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).not.toContain(
      "ANALYTICS_DATABASE_URL",
    );
    expect(PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT).not.toContain(
      "Geo_Country_Name",
    );
  });

  it("requires answer narration to preserve selected units and null meaning", () => {
    expect(PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION).toBe("grounded-answer-v6");
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "selected reviewed semantic context",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "Never treat null as zero or false",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "Never invent a cause for zero",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "must not be a bare number",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "never reorder rows",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "never add numeric 0 or 1",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "never number or ordinally label rows",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "never omit a selected identifier",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "Do not mention query IDs, catalog or dataset versions, timestamps, row counts, or other provenance",
    );
  });
});
