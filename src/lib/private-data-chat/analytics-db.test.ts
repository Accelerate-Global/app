import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postgresMock = vi.fn();

vi.mock("postgres", () => ({ default: postgresMock }));

const originalEnvironment = { ...process.env };

describe("private data chat analytics database lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.ANALYTICS_DATABASE_URL = "postgresql://example.com/postgres";
  });

  afterEach(async () => {
    const { resetPrivateDataChatAnalyticsSqlForTests } = await import(
      "@/lib/private-data-chat/analytics-db"
    );
    resetPrivateDataChatAnalyticsSqlForTests();
    process.env = { ...originalEnvironment };
  });

  it("uses a small unprepared pooled connection and recreates after close", async () => {
    const first = { end: vi.fn().mockResolvedValue(undefined) };
    const second = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { closePrivateDataChatAnalyticsSql, getPrivateDataChatAnalyticsSql } =
      await import("@/lib/private-data-chat/analytics-db");

    expect(getPrivateDataChatAnalyticsSql()).toBe(first);
    expect(getPrivateDataChatAnalyticsSql()).toBe(first);
    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://example.com/postgres",
      expect.objectContaining({ max: 2, prepare: false, ssl: "require" }),
    );

    await closePrivateDataChatAnalyticsSql();
    expect(first.end).toHaveBeenCalledWith({ timeout: 5 });
    expect(getPrivateDataChatAnalyticsSql()).toBe(second);
  });
});
