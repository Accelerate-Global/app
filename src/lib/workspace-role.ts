export const WORKSPACE_ROLES = ["super_admin", "admin", "pro", "basic"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function getWorkspaceRole(value: unknown): WorkspaceRole {
  if (
    value === "super_admin" ||
    value === "admin" ||
    value === "pro" ||
    value === "basic"
  ) {
    return value;
  }

  return "pro";
}

export function isWorkspaceSuperAdmin(value: unknown) {
  return getWorkspaceRole(value) === "super_admin";
}

export function isWorkspaceAdmin(value: unknown) {
  const workspaceRole = getWorkspaceRole(value);
  return workspaceRole === "admin" || workspaceRole === "super_admin";
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
