// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFieldDefinitions } from "@/lib/field-definitions";
import FieldDefinitionsPage from "./page";

const { fieldDefinitionsClientMock } = vi.hoisted(() => ({
  fieldDefinitionsClientMock: vi.fn(() => null),
}));

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


vi.mock("@/components/dashboard/field-definitions-client", () => ({
  FieldDefinitionsClient: fieldDefinitionsClientMock,
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

  it("renders user-facing intro copy for authenticated pro users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "pro-1",
      email: "pro@example.com",
      fullName: null,
      workspaceRole: "pro",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    listFieldDefinitionsMock.mockResolvedValue([]);

    render(await FieldDefinitionsPage());

    expect(document.querySelector(".max-w-7xl")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Definitions", level: 1 }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "These shared definitions explain fields that appear across the datasets in this workspace.",
      ),
    ).toBeTruthy();
    expect(listFieldDefinitionsMock).toHaveBeenCalledWith({
      includeHidden: false,
    });
    expect(fieldDefinitionsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        actorOwnerId: "pro-1",
        workspaceRole: "pro",
      }),
      undefined,
    );
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
    listFieldDefinitionsMock.mockResolvedValue([]);

    render(await FieldDefinitionsPage());

    expect(listFieldDefinitionsMock).toHaveBeenCalledWith({
      includeHidden: true,
    });
    expect(fieldDefinitionsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        actorOwnerId: "owner-1",
        workspaceRole: "admin",
      }),
      undefined,
    );
  });
});
