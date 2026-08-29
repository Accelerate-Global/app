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
      "people-groups-planner-v3",
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
      "Approved joins: none",
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
    expect(PRIVATE_DATA_CHAT_ANSWER_PROMPT_VERSION).toBe("grounded-answer-v2");
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "selected semantic context",
    );
    expect(PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT).toContain(
      "Never treat null as zero or false",
    );
  });
});
