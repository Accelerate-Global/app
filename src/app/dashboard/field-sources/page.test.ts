// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import FieldSourcesPage from "./page";

const { fieldSourcesClientMock } = vi.hoisted(() => ({
  fieldSourcesClientMock: vi.fn(() => null),
}));

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
  FieldSourcesClient: fieldSourcesClientMock,
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
      ownerId: "basic-1",
      email: "basic@example.com",
      fullName: null,
      workspaceRole: "basic",
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
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listFieldSourceGridDataMock.mockResolvedValue({
      fieldSourceTypes: [],
      fieldSources: [],
    });

    render(await FieldSourcesPage());

    expect(listFieldSourceGridDataMock).toHaveBeenCalledWith();
    expect(
      screen.getByText(
        "Field Sources gives the workspace a dedicated home for understanding where shared field data originates and how those source relationships are managed.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Review which source fields currently map to each shared workspace field. These mappings are available here as read-only reference data.",
      ),
    ).toBeTruthy();
    expect(fieldSourcesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialFieldSourceTypes: [],
        initialFieldSources: [],
      }),
      undefined,
    );
  });
});
