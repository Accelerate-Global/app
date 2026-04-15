import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-sources", () => ({
  listFieldSourceGridData: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listFieldSourceGridDataMock = vi.mocked(listFieldSourceGridData);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/field-sources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated reads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listFieldSourceGridDataMock).not.toHaveBeenCalled();
  });

  it("rejects reads from non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listFieldSourceGridDataMock).not.toHaveBeenCalled();
  });

  it("returns the field source grid for admins", async () => {
    const payload = {
      fieldSourceTypes: [],
      fieldSources: [],
    };
    listFieldSourceGridDataMock.mockResolvedValue(payload);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });
});
