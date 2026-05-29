import type { WorkspaceRole } from "@/lib/workspace-role";

export type ProxiedIdentity = {
  ownerId: string;
  email: string | null;
  fullName: string | null;
  workspaceRole: WorkspaceRole;
};

const HEADER_OWNER_ID = "x-ag-internal-auth-owner-id";
const HEADER_EMAIL = "x-ag-internal-auth-email";
const HEADER_FULL_NAME = "x-ag-internal-auth-full-name";
const HEADER_WORKSPACE_ROLE = "x-ag-internal-auth-workspace-role";

export const proxiedIdentityHeaderNames = [
  HEADER_OWNER_ID,
  HEADER_EMAIL,
  HEADER_FULL_NAME,
  HEADER_WORKSPACE_ROLE,
] as const;

function encodeHeaderValue(value: string) {
  return encodeURIComponent(value);
}

function decodeHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function clearProxiedIdentityHeaders(headers: Headers) {
  proxiedIdentityHeaderNames.forEach((name) => {
    headers.delete(name);
  });
}

export function setProxiedIdentityHeaders(
  headers: Headers,
  identity: ProxiedIdentity,
) {
  clearProxiedIdentityHeaders(headers);
  headers.set(HEADER_OWNER_ID, encodeHeaderValue(identity.ownerId));
  headers.set(HEADER_WORKSPACE_ROLE, encodeHeaderValue(identity.workspaceRole));

  if (identity.email) {
    headers.set(HEADER_EMAIL, encodeHeaderValue(identity.email));
  }

  if (identity.fullName) {
    headers.set(HEADER_FULL_NAME, encodeHeaderValue(identity.fullName));
  }
}

export function readProxiedIdentityHeaders(
  headers: Pick<Headers, "get">,
): ProxiedIdentity | null {
  const ownerId = decodeHeaderValue(headers.get(HEADER_OWNER_ID));
  const workspaceRole = decodeHeaderValue(headers.get(HEADER_WORKSPACE_ROLE));

  if (
    !ownerId ||
    (
      workspaceRole !== "super_admin" &&
      workspaceRole !== "admin" &&
      workspaceRole !== "pro" &&
      workspaceRole !== "basic"
    )
  ) {
    return null;
  }

  return {
    ownerId,
    email: decodeHeaderValue(headers.get(HEADER_EMAIL)),
    fullName: decodeHeaderValue(headers.get(HEADER_FULL_NAME)),
    workspaceRole,
  };
}
