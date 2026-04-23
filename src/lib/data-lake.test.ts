import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { listDataLakeSources } from "@/lib/data-lake";

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);

function createQueryMock(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(async () => rows),
  };

  return query;
}

describe("listDataLakeSources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps physical datasets into display rows with organization fallbacks", async () => {
    const query = createQueryMock([
      {
        id: "dataset-1",
        fileName: "joshua-project-april.csv",
        sourceOrganizationName: " Joshua Project ",
        currentVersionCreatedAt: new Date("2026-04-22T18:00:00.000Z"),
        status: "ready",
        rowCount: 422,
        isPublic: true,
      },
      {
        id: "dataset-2",
        fileName: "imb-april.csv",
        sourceOrganizationName: null,
        currentVersionCreatedAt: new Date("2026-04-21T18:00:00.000Z"),
        status: "processing",
        rowCount: 0,
        isPublic: false,
      },
    ]);

    getDbMock.mockReturnValue({
      select: vi.fn(() => query),
    } as never);

    const sources = await listDataLakeSources({ includeDisabled: true });

    expect(sources).toEqual([
      {
        datasetId: "dataset-1",
        displayName: "Joshua Project",
        sourceOrganizationName: "Joshua Project",
        datasetFileName: "joshua-project-april.csv",
        lastUploadAt: "2026-04-22T18:00:00.000Z",
        status: "ready",
        rowCount: 422,
        isPublic: true,
      },
      {
        datasetId: "dataset-2",
        displayName: "imb-april.csv",
        sourceOrganizationName: null,
        datasetFileName: "imb-april.csv",
        lastUploadAt: "2026-04-21T18:00:00.000Z",
        status: "processing",
        rowCount: 0,
        isPublic: false,
      },
    ]);
    expect(query.from).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });
});
