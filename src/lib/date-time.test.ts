import { describe, expect, it } from "vitest";

import { formatUtcTimestamp } from "@/lib/date-time";

describe("formatUtcTimestamp", () => {
  it("renders an explicitly labeled UTC timestamp", () => {
    expect(formatUtcTimestamp("2026-04-24T12:00:00.000Z")).toBe(
      "Apr 24, 2026, 12:00 PM UTC",
    );
  });

  it("uses the requested fallback for empty and invalid values", () => {
    expect(formatUtcTimestamp(null, "Not available")).toBe("Not available");
    expect(formatUtcTimestamp("not-a-date", "Not available")).toBe(
      "Not available",
    );
  });
});
