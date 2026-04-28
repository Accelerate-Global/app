// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listWorkspaceUsers } from "@/lib/user-management";
import UserManagementPage from "./page";

const userManagementClientSpy = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/user-management", () => ({
  listWorkspaceUsers: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/user-management-client", () => ({
  UserManagementClient: (props: unknown) => {
    userManagementClientSpy(props);
    return null;
  },
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listWorkspaceUsersMock = vi.mocked(listWorkspaceUsers);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/user-management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    userManagementClientSpy.mockReset();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(UserManagementPage()).rejects.toThrow("NEXT_REDIRECT:/");
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

    await expect(UserManagementPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
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
    listWorkspaceUsersMock.mockResolvedValue([]);

    const view = await UserManagementPage();

    expect(view).toBeTruthy();
    expect(listWorkspaceUsersMock).toHaveBeenCalledWith();
    render(view);
    expect(userManagementClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: "owner-1",
        actorOwnerId: "owner-1",
        workspaceRole: "admin",
      }),
    );
  });
});
