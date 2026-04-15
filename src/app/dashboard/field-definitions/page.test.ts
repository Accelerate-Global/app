// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFieldDefinitions } from "@/lib/field-definitions";
import FieldDefinitionsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-definitions", () => ({
  listFieldDefinitions: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/field-definitions-client", () => ({
  FieldDefinitionsClient: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listFieldDefinitionsMock = vi.mocked(listFieldDefinitions);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/field-definitions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(FieldDefinitionsPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders viewer-facing intro copy for authenticated viewers", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: null,
      isDatasetAdmin: false,
      mode: "supabase",
    });
    listFieldDefinitionsMock.mockResolvedValue([]);

    render(await FieldDefinitionsPage());

    expect(
      screen.getByText(
        "Use the info icons in dataset headers to learn what each field means.",
      ),
    ).toBeTruthy();
    expect(listFieldDefinitionsMock).toHaveBeenCalledWith();
  });

  it("renders for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listFieldDefinitionsMock.mockResolvedValue([]);

    const view = await FieldDefinitionsPage();

    expect(view).toBeTruthy();
    expect(listFieldDefinitionsMock).toHaveBeenCalledWith();
  });
});
