import { describe, expect, it, vi } from "vitest";

import { logError, normalizeErrorForLogging } from "./error-logging";

describe("error-logging", () => {
  it("normalizes error instances to a safe shape", () => {
    const error = Object.assign(new Error("Failed to reach Supabase"), {
      name: "SupabaseError",
      status: 502,
      code: "storage_failed",
      details: { raw: "secret" },
    });

    expect(normalizeErrorForLogging(error)).toEqual({
      name: "SupabaseError",
      message: "Failed to reach Supabase",
      status: 502,
      code: "storage_failed",
    });
  });

  it("normalizes non-Error objects and primitive values", () => {
    expect(
      normalizeErrorForLogging({
        message: "Request failed",
        status: 401,
        code: "bad_jwt",
        debug: "sensitive",
      }),
    ).toEqual({
      name: "Error",
      message: "Request failed",
      status: 401,
      code: "bad_jwt",
    });

    expect(normalizeErrorForLogging("plain failure")).toEqual({
      name: "Error",
      message: "plain failure",
    });
  });

  it("logs the normalized error payload instead of the raw object", () => {
    const logger = vi.fn();
    const error = Object.assign(new Error("Failed to track analytics event"), {
      status: 500,
      code: "track_failed",
    });

    logError("Failed to persist analytics event", error, logger);

    expect(logger).toHaveBeenCalledWith("Failed to persist analytics event", {
      name: "Error",
      message: "Failed to track analytics event",
      status: 500,
      code: "track_failed",
    });
  });
});
