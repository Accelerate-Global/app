import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { refreshAllDerivedDatasets } from "@/lib/datasets";
import {
  createFilterRegion,
  deleteFilterRegion,
  listRegionCountryOptions,
  updateFilterRegion,
} from "@/lib/filter-settings";
import { REGION_COUNTRY_OPTIONS } from "@/lib/region-country-options";

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  refreshAllDerivedDatasets: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);
const refreshAllDerivedDatasetsMock = vi.mocked(refreshAllDerivedDatasets);

describe("filter settings helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the static region picker master list", async () => {
    await expect(listRegionCountryOptions()).resolves.toEqual(
      REGION_COUNTRY_OPTIONS,
    );
  });

  it("refreshes derived datasets after creating a region", async () => {
    const createdAt = new Date("2026-04-22T16:00:00.000Z");
    const updatedAt = new Date("2026-04-22T16:00:00.000Z");
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));
    const insertRegionReturningMock = vi.fn().mockResolvedValue([
      {
        id: "10000000-0000-4000-8000-000000000001",
        name: "South Asia",
        description: "India and Nepal",
        sortOrder: 2,
        createdAt,
        updatedAt,
      },
    ]);
    const insertRegionValuesMock = vi.fn(() => ({
      returning: insertRegionReturningMock,
    }));
    const insertCountriesValuesMock = vi.fn().mockResolvedValue(undefined);
    const transactionMock = vi.fn(async (callback) =>
      callback({
        insert: vi
          .fn()
          .mockReturnValueOnce({ values: insertRegionValuesMock })
          .mockReturnValueOnce({ values: insertCountriesValuesMock }),
      }),
    );

    getDbMock.mockReturnValue({
      select: selectMock,
      transaction: transactionMock,
    } as never);

    const region = await createFilterRegion({
      name: "South Asia",
      description: "India and Nepal",
      sortOrder: 2,
      countries: ["Nepal", "India"],
    });

    expect(region).toEqual({
      id: "10000000-0000-4000-8000-000000000001",
      name: "South Asia",
      description: "India and Nepal",
      sortOrder: 2,
      countries: ["India", "Nepal"],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(refreshAllDerivedDatasetsMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes derived datasets after updating a region", async () => {
    const createdAt = new Date("2026-04-20T16:00:00.000Z");
    const updatedAt = new Date("2026-04-22T16:00:00.000Z");
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: whereMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));
    const updateReturningMock = vi.fn().mockResolvedValue([
      {
        id: "10000000-0000-4000-8000-000000000001",
        name: "South Asia Updated",
        description: "India, Nepal, and Bhutan",
        sortOrder: 3,
        createdAt,
        updatedAt,
      },
    ]);
    const updateWhereMock = vi.fn(() => ({ returning: updateReturningMock }));
    const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const insertCountriesValuesMock = vi.fn().mockResolvedValue(undefined);
    const transactionMock = vi.fn(async (callback) =>
      callback({
        update: vi.fn(() => ({ set: updateSetMock })),
        delete: vi.fn(() => ({ where: deleteWhereMock })),
        insert: vi.fn(() => ({ values: insertCountriesValuesMock })),
      }),
    );

    getDbMock.mockReturnValue({
      select: selectMock,
      transaction: transactionMock,
    } as never);

    const region = await updateFilterRegion({
      regionId: "10000000-0000-4000-8000-000000000001",
      name: "South Asia Updated",
      description: "India, Nepal, and Bhutan",
      sortOrder: 3,
      countries: ["Nepal", "Bhutan", "India"],
    });

    expect(region).toEqual({
      id: "10000000-0000-4000-8000-000000000001",
      name: "South Asia Updated",
      description: "India, Nepal, and Bhutan",
      sortOrder: 3,
      countries: ["Bhutan", "India", "Nepal"],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(refreshAllDerivedDatasetsMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes derived datasets after deleting a region", async () => {
    const returningMock = vi.fn().mockResolvedValue([
      { id: "10000000-0000-4000-8000-000000000001" },
    ]);
    const whereMock = vi.fn(() => ({ returning: returningMock }));
    const deleteMock = vi.fn(() => ({ where: whereMock }));

    getDbMock.mockReturnValue({
      delete: deleteMock,
    } as never);

    await expect(
      deleteFilterRegion("10000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual({
      id: "10000000-0000-4000-8000-000000000001",
    });
    expect(refreshAllDerivedDatasetsMock).toHaveBeenCalledTimes(1);
  });
});
