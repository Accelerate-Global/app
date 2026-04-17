import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const drizzleMock = vi.fn();
const postgresMock = vi.fn();

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleMock,
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("db lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.DATABASE_URL = "postgresql://example.com/postgres";
  });

  afterEach(async () => {
    const { resetDbForTests } = await import("./index");
    resetDbForTests();

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
      return;
    }

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("memoizes the shared client, closes it, and recreates it on demand", async () => {
    const firstSql = {
      end: vi.fn().mockResolvedValue(undefined),
    };
    const secondSql = {
      end: vi.fn().mockResolvedValue(undefined),
    };
    const firstDb = {
      name: "first-db",
    };
    const secondDb = {
      name: "second-db",
    };

    postgresMock.mockReturnValueOnce(firstSql).mockReturnValueOnce(secondSql);
    drizzleMock.mockReturnValueOnce(firstDb).mockReturnValueOnce(secondDb);

    const { closeDb, getDb } = await import("./index");

    expect(getDb()).toBe(firstDb);
    expect(getDb()).toBe(firstDb);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(drizzleMock).toHaveBeenCalledTimes(1);

    await closeDb();

    expect(firstSql.end).toHaveBeenCalledWith({ timeout: 5 });

    expect(getDb()).toBe(secondDb);
    expect(postgresMock).toHaveBeenCalledTimes(2);
    expect(drizzleMock).toHaveBeenCalledTimes(2);
  });

  it("resets the singleton for tests without requiring a live connection", async () => {
    const firstSql = {
      end: vi.fn().mockResolvedValue(undefined),
    };
    const secondSql = {
      end: vi.fn().mockResolvedValue(undefined),
    };
    const firstDb = {
      name: "first-db",
    };
    const secondDb = {
      name: "second-db",
    };

    postgresMock.mockReturnValueOnce(firstSql).mockReturnValueOnce(secondSql);
    drizzleMock.mockReturnValueOnce(firstDb).mockReturnValueOnce(secondDb);

    const { getDb, resetDbForTests } = await import("./index");

    expect(getDb()).toBe(firstDb);

    resetDbForTests();

    expect(firstSql.end).not.toHaveBeenCalled();
    expect(getDb()).toBe(secondDb);
    expect(postgresMock).toHaveBeenCalledTimes(2);
    expect(drizzleMock).toHaveBeenCalledTimes(2);
  });
});
