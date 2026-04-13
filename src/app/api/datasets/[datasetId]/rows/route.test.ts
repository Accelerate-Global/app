import { beforeEach, describe, expect, it, vi } from "vitest";

import { BYPASS_OWNER_ID, getCurrentOwnerId } from "@/lib/auth";
import { getDatasetRows } from "@/lib/datasets";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  BYPASS_OWNER_ID: "bypass-user",
  getCurrentOwnerId: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getDatasetRows: vi.fn(),
}));

const getCurrentOwnerIdMock = vi.mocked(getCurrentOwnerId);
const getDatasetRowsMock = vi.mocked(getDatasetRows);

const context = {
  params: Promise.resolve({
    datasetId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const rowsResponse = {
  rows: [
    {
      id: "r0000000-0000-4000-8000-000000000001",
      rowIndex: 0,
      data: { email: "ada@example.com" },
    },
  ],
  page: 2,
  pageSize: 10,
  totalRows: 25,
  pageCount: 3,
};

describe("/api/datasets/[datasetId]/rows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentOwnerIdMock.mockResolvedValue("supabase-user");
  });

  it("rejects unauthenticated row requests", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetRowsMock).not.toHaveBeenCalled();
  });

  it("reads rows through the Supabase owner id", async () => {
    getDatasetRowsMock.mockResolvedValue(rowsResponse);

    const response = await GET(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows?page=2&pageSize=10&filter=ada&sortColumn=email&sortDirection=desc",
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rowsResponse);
    expect(getDatasetRowsMock).toHaveBeenCalledWith({
      datasetId: "f0000000-0000-4000-8000-000000000001",
      ownerId: "supabase-user",
      page: 2,
      pageSize: 10,
      filter: "ada",
      sortColumn: "email",
      sortDirection: "desc",
    });
  });

  it("reads rows through the bypass owner id", async () => {
    getCurrentOwnerIdMock.mockResolvedValue(BYPASS_OWNER_ID);
    getDatasetRowsMock.mockResolvedValue(rowsResponse);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows"),
      context,
    );

    expect(response.status).toBe(200);
    expect(getDatasetRowsMock).toHaveBeenCalledWith({
      datasetId: "f0000000-0000-4000-8000-000000000001",
      ownerId: BYPASS_OWNER_ID,
      page: 1,
      pageSize: 25,
      filter: undefined,
      sortColumn: undefined,
      sortDirection: "asc",
    });
  });

  it("returns not found for cross-owner row access", async () => {
    getDatasetRowsMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows"),
      context,
    );

    expect(response.status).toBe(404);
  });
});
