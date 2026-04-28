import { describe, expect, it } from "vitest";

import {
  canCreateSavedDatasetTables,
  canDisableOwnAccount,
  canUpdateOwnProfile,
  getWorkspaceRole,
  isWorkspaceAdmin,
} from "@/lib/workspace-role";

describe("workspace-role", () => {
  it("resolves canonical workspace roles", () => {
    expect(getWorkspaceRole("admin")).toBe("admin");
    expect(getWorkspaceRole("pro")).toBe("pro");
    expect(getWorkspaceRole("basic")).toBe("basic");
  });

  it("maps legacy viewer, missing, and unknown roles to pro", () => {
    expect(getWorkspaceRole("viewer")).toBe("pro");
    expect(getWorkspaceRole(undefined)).toBe("pro");
    expect(getWorkspaceRole("other")).toBe("pro");
  });

  it("keeps admin checks based on the canonical role", () => {
    expect(isWorkspaceAdmin("admin")).toBe(true);
    expect(isWorkspaceAdmin("viewer")).toBe(false);
    expect(isWorkspaceAdmin("basic")).toBe(false);
  });

  it("restricts basic-only account and saved-table capabilities", () => {
    expect(canUpdateOwnProfile("basic")).toBe(false);
    expect(canDisableOwnAccount("basic")).toBe(false);
    expect(canCreateSavedDatasetTables("basic")).toBe(false);
    expect(canUpdateOwnProfile("viewer")).toBe(true);
    expect(canDisableOwnAccount("pro")).toBe(true);
    expect(canCreateSavedDatasetTables("admin")).toBe(true);
  });
});
