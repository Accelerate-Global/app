import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_CATALOG,
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
} from "@/lib/private-data-chat/catalog";

describe("private data chat catalog", () => {
  it("maps every approved dimension and filter to a trusted field", () => {
    for (const key of PRIVATE_DATA_CHAT_FILTER_KEYS) {
      expect(PRIVATE_DATA_CHAT_CATALOG.fields[key].column).toMatch(/^[a-z_]+$/);
    }

    for (const key of PRIVATE_DATA_CHAT_DIMENSION_KEYS) {
      expect(PRIVATE_DATA_CHAT_CATALOG.fields[key]).toBeDefined();
    }
  });

  it("maps every approved metric to a server-owned expression", () => {
    for (const key of PRIVATE_DATA_CHAT_METRIC_KEYS) {
      expect(PRIVATE_DATA_CHAT_CATALOG.metrics[key].expression).not.toContain("$");
    }
  });
});
