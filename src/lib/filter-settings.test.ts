import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";

import { listFilterRegions } from "./filter-settings";

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);

describe("filter region queries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("groups joined country rows into sorted filter regions", async () => {
    const orderByMock = vi.fn().mockResolvedValue([
      {
        id: "region-global",
        name: "Global",
        description: "All countries",
        sortOrder: 1,
        createdAt: new Date("2026-04-22T17:00:00.000Z"),
        updatedAt: new Date("2026-04-22T17:00:00.000Z"),
        countryName: "Nepal",
      },
      {
        id: "region-global",
        name: "Global",
        description: "All countries",
        sortOrder: 1,
        createdAt: new Date("2026-04-22T17:00:00.000Z"),
        updatedAt: new Date("2026-04-22T17:00:00.000Z"),
        countryName: "India",
      },
      {
        id: "region-asia-south",
        name: "Asia, South",
        description: "",
        sortOrder: 9,
        createdAt: new Date("2026-04-22T18:00:00.000Z"),
        updatedAt: new Date("2026-04-22T18:00:00.000Z"),
        countryName: "Pakistan",
      },
      {
        id: "region-asia-south",
        name: "Asia, South",
        description: "",
        sortOrder: 9,
        createdAt: new Date("2026-04-22T18:00:00.000Z"),
        updatedAt: new Date("2026-04-22T18:00:00.000Z"),
        countryName: "Bangladesh",
      },
    ]);
    const leftJoinMock = vi.fn(() => ({ orderBy: orderByMock }));
    const fromMock = vi.fn(() => ({ leftJoin: leftJoinMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));

    getDbMock.mockReturnValue({
      select: selectMock,
    } as never);

    await expect(listFilterRegions()).resolves.toEqual([
      {
        id: "region-global",
        name: "Global",
        description: "All countries",
        sortOrder: 1,
        countries: ["India", "Nepal"],
        createdAt: "2026-04-22T17:00:00.000Z",
        updatedAt: "2026-04-22T17:00:00.000Z",
      },
      {
        id: "region-asia-south",
        name: "Asia, South",
        description: "",
        sortOrder: 9,
        countries: ["Bangladesh", "Pakistan"],
        createdAt: "2026-04-22T18:00:00.000Z",
        updatedAt: "2026-04-22T18:00:00.000Z",
      },
    ]);
  });

  it("returns regions without countries when no joined country rows exist", async () => {
    const orderByMock = vi.fn().mockResolvedValue([
      {
        id: "region-empty",
        name: "Europe, Western",
        description: "",
        sortOrder: 13,
        createdAt: new Date("2026-04-22T19:00:00.000Z"),
        updatedAt: new Date("2026-04-22T19:00:00.000Z"),
        countryName: null,
      },
    ]);
    const leftJoinMock = vi.fn(() => ({ orderBy: orderByMock }));
    const fromMock = vi.fn(() => ({ leftJoin: leftJoinMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));

    getDbMock.mockReturnValue({
      select: selectMock,
    } as never);

    await expect(listFilterRegions()).resolves.toEqual([
      {
        id: "region-empty",
        name: "Europe, Western",
        description: "",
        sortOrder: 13,
        countries: [],
        createdAt: "2026-04-22T19:00:00.000Z",
        updatedAt: "2026-04-22T19:00:00.000Z",
      },
    ]);
  });
});
