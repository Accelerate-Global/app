export const WORKSPACE_ROLES = ["admin", "pro", "basic"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function getWorkspaceRole(value: unknown): WorkspaceRole {
  if (value === "admin" || value === "basic") {
    return value;
  }

  return "pro";
}

export function isWorkspaceAdmin(value: unknown) {
  return getWorkspaceRole(value) === "admin";
}

export function canUpdateOwnProfile(value: unknown) {
  return getWorkspaceRole(value) !== "basic";
}

export function canDisableOwnAccount(value: unknown) {
  return getWorkspaceRole(value) !== "basic";
}

export function canCreateSavedDatasetTables(value: unknown) {
  return getWorkspaceRole(value) !== "basic";
}
