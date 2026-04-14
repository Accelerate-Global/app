import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getAllDatasetRows, getDatasetRows } from "@/lib/datasets";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getAllDatasetRows: vi.fn(),
  getDatasetRows: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getAllDatasetRowsMock = vi.mocked(getAllDatasetRows);
const getDatasetRowsMock = vi.mocked(getDatasetRows);

const identity = {
  ownerId: "viewer-user",
  email: "viewer@example.com",
  fullName: null,
  isDatasetAdmin: false,
  mode: "supabase" as const,
};

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
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated row requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetRowsMock).not.toHaveBeenCalled();
  });

  it("reads rows for any authenticated user", async () => {
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
      page: 2,
      pageSize: 10,
      filter: "ada",
      sortColumn: "email",
      sortDirection: "desc",
    });
  });

  it("reads all rows in one request when all=true", async () => {
    const allRowsResponse = {
      rows: [
        {
          id: "r0000000-0000-4000-8000-000000000001",
          rowIndex: 0,
          data: { email: "ada@example.com" },
        },
        {
          id: "r0000000-0000-4000-8000-000000000002",
          rowIndex: 1,
          data: { email: "grace@example.com" },
        },
      ],
      page: 1,
      pageSize: 2,
      totalRows: 2,
      pageCount: 1,
    };

    getAllDatasetRowsMock.mockResolvedValue(allRowsResponse);

    const response = await GET(
      new Request(
        "http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows?all=true",
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(allRowsResponse);
    expect(getAllDatasetRowsMock).toHaveBeenCalledWith({
      datasetId: "f0000000-0000-4000-8000-000000000001",
    });
    expect(getDatasetRowsMock).not.toHaveBeenCalled();
  });

  it("returns not found when the dataset does not exist", async () => {
    getDatasetRowsMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/rows"),
      context,
    );

    expect(response.status).toBe(404);
  });
});
