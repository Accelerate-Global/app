import { describe, expect, it } from "vitest";

import { formatUnknownError } from "./format-error";

describe("format-error", () => {
  it("formats Error instances with stack output", () => {
    const message = formatUnknownError(new Error("boom"));

    expect(message).toContain("boom");
    expect(message).toContain("Error");
  });

  it("includes nested causes and enumerable fields", () => {
    const error = new Error("outer", {
      cause: new Error("inner"),
    }) as Error & { context?: Record<string, string> };
    error.context = {
      scope: "bootstrap",
    };

    const message = formatUnknownError(error);

    expect(message).toContain("outer");
    expect(message).toContain("inner");
    expect(message).toContain("bootstrap");
  });

  it("formats plain objects as readable JSON", () => {
    const message = formatUnknownError({
      message: "plain-object failure",
      status: 503,
    });

    expect(message).toContain("plain-object failure");
    expect(message).toContain("\"status\": 503");
  });
});
