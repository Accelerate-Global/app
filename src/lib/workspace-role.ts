export const WORKSPACE_ROLES = ["admin", "viewer"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function getWorkspaceRole(value: unknown): WorkspaceRole {
  return value === "admin" ? "admin" : "viewer";
}

export function isWorkspaceAdmin(value: unknown) {
  return getWorkspaceRole(value) === "admin";
}
