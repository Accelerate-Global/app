import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import FieldSourcesPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-sources", () => ({
  listFieldSourceGridData: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/field-sources-client", () => ({
  FieldSourcesClient: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listFieldSourceGridDataMock = vi.mocked(listFieldSourceGridData);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/field-sources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(FieldSourcesPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin users back to the dashboard", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: null,
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(FieldSourcesPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listFieldSourceGridDataMock.mockResolvedValue({
      fieldSourceTypes: [],
      fieldSources: [],
    });

    const view = await FieldSourcesPage();

    expect(view).toBeTruthy();
    expect(listFieldSourceGridDataMock).toHaveBeenCalledWith();
  });
});
