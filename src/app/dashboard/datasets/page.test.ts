import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getDefaultDataset } from "@/lib/datasets";
import DatasetsIndexPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getDefaultDataset: vi.fn(),
}));

const redirectMock = vi.mocked(redirect);
const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDefaultDatasetMock = vi.mocked(getDefaultDataset);

const identity = {
  ownerId: "supabase-user",
  email: "viewer@example.com",
  fullName: null,
  isDatasetAdmin: false,
  mode: "supabase" as const,
};

describe("/dashboard/datasets", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects unauthenticated users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(DatasetsIndexPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(getDefaultDatasetMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to the default dataset", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    getDefaultDatasetMock.mockResolvedValue({
      id: "f0000000-0000-4000-8000-000000000001",
    } as never);

    await expect(DatasetsIndexPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/datasets/f0000000-0000-4000-8000-000000000001?source=default_redirect",
    );
    expect(getDefaultDatasetMock).toHaveBeenCalledWith({
      includeDisabled: false,
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard/datasets/f0000000-0000-4000-8000-000000000001?source=default_redirect",
    );
  });

  it("falls back to the dataset list when no default dataset exists", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    getDefaultDatasetMock.mockResolvedValue(null);

    await expect(DatasetsIndexPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
