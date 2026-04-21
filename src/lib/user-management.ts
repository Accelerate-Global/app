import { sql } from "drizzle-orm";
import type { User as AuthUser } from "@supabase/supabase-js";

import { getDb } from "@/db";
import type {
  WorkspaceUser,
  WorkspaceUserAccountStatus,
} from "@/lib/api-types";
import { normalizeEmail } from "@/lib/signup-allowlist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceRole } from "@/lib/workspace-role";
import { getWorkspaceRole } from "@/lib/workspace-role";

export const ACCOUNT_DISABLE_DURATION = "876000h";

type WorkspaceIdentityRecord = {
  id: string;
  provider: string | null;
  created_at: Date | string | null;
  last_sign_in_at: Date | string | null;
};

type WorkspaceUserRecord = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
  raw_app_meta_data: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  invited_at: Date | string | null;
  confirmed_at: Date | string | null;
  email_confirmed_at: Date | string | null;
  last_sign_in_at: Date | string | null;
  banned_until: Date | string | null;
  identities: WorkspaceIdentityRecord[] | null;
};

type SignupAllowlistProvisionResult = {
  created: boolean;
};

export class WorkspaceUserNotFoundError extends Error {
  constructor(message = "User not found.") {
    super(message);
    this.name = "WorkspaceUserNotFoundError";
  }
}

export class WorkspaceUserPermissionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "WorkspaceUserPermissionError";
  }
}

export class WorkspaceUserActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "WorkspaceUserActionError";
  }
}

function normalizeFullName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function toIsoOrNull(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function getUserFullNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  const fullName = metadata?.full_name;
  return typeof fullName === "string" ? normalizeFullName(fullName) : null;
}

export function mergeWorkspaceRoleIntoAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
  workspaceRole: WorkspaceRole,
) {
  return {
    ...(appMetadata ?? {}),
    workspace_role: workspaceRole,
  };
}

export function isAuthUserDisabled(
  user: Pick<AuthUser, "banned_until"> | Pick<WorkspaceUserRecord, "banned_until">,
  now = new Date(),
) {
  if (!user.banned_until) {
    return false;
  }

  const bannedUntil = new Date(user.banned_until);
  return !Number.isNaN(bannedUntil.getTime()) && bannedUntil > now;
}

export function getWorkspaceUserAccountStatus(
  user: Pick<
    AuthUser,
    "banned_until" | "invited_at" | "confirmed_at" | "email_confirmed_at" | "last_sign_in_at"
  >,
  now = new Date(),
): WorkspaceUserAccountStatus {
  if (isAuthUserDisabled(user, now)) {
    return "disabled";
  }

  if (user.invited_at && !user.last_sign_in_at) {
    return "pending_invite";
  }

  if (!user.email_confirmed_at && !user.confirmed_at) {
    return "pending_confirmation";
  }

  return "active";
}

function getWorkspaceUserProviders(input: {
  appMetadata: Record<string, unknown> | null | undefined;
  identities: Array<{ provider: string | null | undefined }> | null | undefined;
}) {
  const providers = new Set<string>();
  const providerList = input.appMetadata?.providers;

  if (Array.isArray(providerList)) {
    for (const provider of providerList) {
      if (typeof provider === "string" && provider.trim()) {
        providers.add(provider.trim());
      }
    }
  }

  const provider = input.appMetadata?.provider;

  if (typeof provider === "string" && provider.trim()) {
    providers.add(provider.trim());
  }

  for (const identity of input.identities ?? []) {
    if (typeof identity.provider === "string" && identity.provider.trim()) {
      providers.add(identity.provider.trim());
    }
  }

  return [...providers].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

function mapWorkspaceUserRecordToWorkspaceUser(user: WorkspaceUserRecord): WorkspaceUser {
  const identities = user.identities ?? [];

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: getUserFullNameFromMetadata(user.raw_user_meta_data),
    workspaceRole: getWorkspaceRole(user.raw_app_meta_data?.workspace_role),
    accountStatus: getWorkspaceUserAccountStatus({
      banned_until: toIsoOrNull(user.banned_until) ?? undefined,
      invited_at: toIsoOrNull(user.invited_at) ?? undefined,
      confirmed_at: toIsoOrNull(user.confirmed_at) ?? undefined,
      email_confirmed_at: toIsoOrNull(user.email_confirmed_at) ?? undefined,
      last_sign_in_at: toIsoOrNull(user.last_sign_in_at) ?? undefined,
    }),
    providers: getWorkspaceUserProviders({
      appMetadata: user.raw_app_meta_data,
      identities,
    }),
    identities: identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider ?? "unknown",
      createdAt: toIsoOrNull(identity.created_at),
      lastLoginAt: toIsoOrNull(identity.last_sign_in_at),
    })),
    createdAt: toIsoOrNull(user.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoOrNull(user.updated_at),
    invitedAt: toIsoOrNull(user.invited_at),
    confirmedAt: toIsoOrNull(user.confirmed_at),
    emailConfirmedAt: toIsoOrNull(user.email_confirmed_at),
    lastLoginAt: toIsoOrNull(user.last_sign_in_at),
    bannedUntil: toIsoOrNull(user.banned_until),
  };
}

export function mapAuthUserToWorkspaceUser(user: AuthUser): WorkspaceUser {
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: getUserFullNameFromMetadata(user.user_metadata),
    workspaceRole: getWorkspaceRole(user.app_metadata?.workspace_role),
    accountStatus: getWorkspaceUserAccountStatus(user),
    providers: getWorkspaceUserProviders({
      appMetadata: user.app_metadata,
      identities: user.identities,
    }),
    identities: (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider ?? "unknown",
      createdAt: toIsoOrNull(identity.created_at),
      lastLoginAt: toIsoOrNull(identity.last_sign_in_at),
    })),
    createdAt: user.created_at,
    updatedAt: toIsoOrNull(user.updated_at),
    invitedAt: toIsoOrNull(user.invited_at),
    confirmedAt: toIsoOrNull(user.confirmed_at),
    emailConfirmedAt: toIsoOrNull(user.email_confirmed_at),
    lastLoginAt: toIsoOrNull(user.last_sign_in_at),
    bannedUntil: toIsoOrNull(user.banned_until),
  };
}

export function sortWorkspaceUsers(users: WorkspaceUser[]) {
  return [...users].sort((left, right) => {
    const createdAtDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return (left.email ?? left.id).localeCompare(right.email ?? right.id, undefined, {
      sensitivity: "base",
    });
  });
}

async function listWorkspaceUserRecords(userId?: string) {
  const result = await getDb().execute(
    sql<WorkspaceUserRecord>`
      select
        u.id::text as id,
        u.email,
        u.raw_user_meta_data,
        u.raw_app_meta_data,
        u.created_at,
        u.updated_at,
        u.invited_at,
        u.confirmed_at,
        u.email_confirmed_at,
        u.last_sign_in_at,
        u.banned_until,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'id', i.id::text,
                'provider', i.provider,
                'created_at', i.created_at,
                'last_sign_in_at', i.last_sign_in_at
              )
              order by i.created_at asc
            )
            from auth.identities i
            where i.user_id = u.id
          ),
          '[]'::json
        ) as identities
      from auth.users u
      where u.deleted_at is null
        and (${userId ?? null}::uuid is null or u.id = ${userId ?? null}::uuid)
      order by u.created_at desc
    `,
  );

  return result as unknown as WorkspaceUserRecord[];
}

async function getWorkspaceUserRecordByIdOrThrow(userId: string) {
  const [user] = await listWorkspaceUserRecords(userId);

  if (!user) {
    throw new WorkspaceUserNotFoundError();
  }

  return user;
}

function isSupabaseAdminJwtError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "bad_jwt" || error.code === "no_authorization")
  );
}

async function applyWorkspaceUserMutationWithSql(input: {
  userId: string;
  workspaceRole?: WorkspaceRole;
  disabled?: boolean;
}) {
  const workspaceRole = input.workspaceRole ?? null;
  const disabled = input.disabled ?? null;

  await getDb().execute(sql`
    update auth.users
    set
      raw_app_meta_data = case
        when ${workspaceRole}::text is null then raw_app_meta_data
        else jsonb_set(
          coalesce(raw_app_meta_data, '{}'::jsonb),
          '{workspace_role}',
          to_jsonb(${workspaceRole}::text),
          true
        )
      end,
      banned_until = case
        when ${disabled}::boolean is null then banned_until
        when ${disabled}::boolean then now() + interval '876000 hours'
        else null
      end
    where id = ${input.userId}::uuid
      and deleted_at is null
  `);
}

async function applyWorkspaceUserMutation(input: {
  userId: string;
  appMetadata: Record<string, unknown> | null;
  workspaceRole?: WorkspaceRole;
  disabled?: boolean;
}) {
  if (input.workspaceRole === undefined && input.disabled === undefined) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const updateResult = await admin.auth.admin.updateUserById(input.userId, {
    ...(input.workspaceRole
      ? {
          app_metadata: mergeWorkspaceRoleIntoAppMetadata(
            input.appMetadata,
            input.workspaceRole,
          ),
        }
      : {}),
    ...(input.disabled !== undefined
      ? {
          ban_duration: input.disabled ? ACCOUNT_DISABLE_DURATION : "none",
        }
      : {}),
  });

  if (!updateResult.error) {
    return;
  }

  if (isSupabaseAdminJwtError(updateResult.error)) {
    await applyWorkspaceUserMutationWithSql(input);
    return;
  }

  throw updateResult.error;
}

async function upsertSignupAllowlistEmail(email: string, workspaceRole: WorkspaceRole) {
  const note = `User Management allowlist (${workspaceRole})`;
  const [result] = (await getDb().execute(sql<SignupAllowlistProvisionResult>`
    with inserted as (
      insert into public.signup_email_allowlist (email, note)
      values (${email}, ${note})
      on conflict (email) do nothing
      returning email
    )
    update public.signup_email_allowlist
    set note = ${note},
        updated_at = now()
    where email = ${email}
    returning exists(select 1 from inserted) as created
  `)) as unknown as SignupAllowlistProvisionResult[];

  return {
    created: result?.created ?? false,
  };
}

async function removeSignupAllowlistEmail(email: string) {
  await getDb().execute(sql`
    delete from public.signup_email_allowlist
    where email = ${email}
  `);
}

export async function revokeWorkspaceUserSessions(userId: string) {
  await getDb().execute(sql`delete from auth.sessions where user_id = ${userId}`);
}

export async function listWorkspaceUsers() {
  const users = await listWorkspaceUserRecords();
  return sortWorkspaceUsers(users.map(mapWorkspaceUserRecordToWorkspaceUser));
}

export function getActiveWorkspaceAdminCount(
  users: Pick<WorkspaceUser, "workspaceRole" | "accountStatus">[],
) {
  return users.filter(
    (user) =>
      user.workspaceRole === "admin" &&
      user.accountStatus !== "disabled",
  ).length;
}

export function assertWorkspaceUserMutationAllowed(input: {
  currentUserId: string;
  targetUser: WorkspaceUser;
  users: WorkspaceUser[];
  workspaceRole?: WorkspaceRole;
  disabled?: boolean;
}) {
  if (input.targetUser.id === input.currentUserId) {
    throw new WorkspaceUserPermissionError(
      "You cannot change your own role or status from User Management.",
      400,
    );
  }

  const isTargetActiveAdmin =
    input.targetUser.workspaceRole === "admin" &&
    input.targetUser.accountStatus !== "disabled";
  const removesActiveAdmin =
    (input.disabled === true && isTargetActiveAdmin) ||
    (input.workspaceRole === "viewer" && isTargetActiveAdmin);

  if (
    removesActiveAdmin &&
    getActiveWorkspaceAdminCount(input.users) <= 1
  ) {
    throw new WorkspaceUserPermissionError(
      "The last active admin cannot be disabled or demoted.",
    );
  }
}

export function assertWorkspaceUserPasswordResetAllowed(
  targetUser: Pick<WorkspaceUser, "email" | "accountStatus">,
): asserts targetUser is Pick<WorkspaceUser, "accountStatus"> & { email: string } {
  if (!targetUser.email) {
    throw new WorkspaceUserActionError(
      "This account does not have an email address.",
      400,
    );
  }

  if (targetUser.accountStatus === "disabled") {
    throw new WorkspaceUserActionError(
      "Re-enable the account before sending a password reset email.",
      409,
    );
  }
}

export async function inviteWorkspaceUser(input: {
  email: string;
  fullName?: string;
  workspaceRole: WorkspaceRole;
  redirectTo?: string;
}) {
  const email = normalizeEmail(input.email);
  const fullName = normalizeFullName(input.fullName);

  const allowlistProvision = await upsertSignupAllowlistEmail(email, input.workspaceRole);

  const admin = createSupabaseAdminClient();
  const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: input.redirectTo,
  });

  if (inviteResult.error) {
    if (allowlistProvision.created) {
      await removeSignupAllowlistEmail(email);
    }

    throw inviteResult.error;
  }

  const invitedUser = inviteResult.data.user;

  if (!invitedUser) {
    throw new WorkspaceUserNotFoundError("The invited user could not be loaded.");
  }

  await applyWorkspaceUserMutation({
    userId: invitedUser.id,
    appMetadata: invitedUser.app_metadata,
    workspaceRole: input.workspaceRole,
  });

  const user = await getWorkspaceUserRecordByIdOrThrow(invitedUser.id);
  return mapWorkspaceUserRecordToWorkspaceUser(user);
}

export async function setWorkspaceUserDisabled(userId: string, disabled: boolean) {
  const user = await getWorkspaceUserRecordByIdOrThrow(userId);

  await applyWorkspaceUserMutation({
    userId,
    appMetadata: user.raw_app_meta_data,
    disabled,
  });

  if (disabled) {
    await revokeWorkspaceUserSessions(userId);
  }

  return mapWorkspaceUserRecordToWorkspaceUser(
    await getWorkspaceUserRecordByIdOrThrow(userId),
  );
}

export async function updateWorkspaceUser(input: {
  currentUserId: string;
  userId: string;
  workspaceRole?: WorkspaceRole;
  disabled?: boolean;
}) {
  const [userRecords, targetUserRecord] = await Promise.all([
    listWorkspaceUserRecords(),
    getWorkspaceUserRecordByIdOrThrow(input.userId),
  ]);
  const users = sortWorkspaceUsers(userRecords.map(mapWorkspaceUserRecordToWorkspaceUser));
  const targetUser = mapWorkspaceUserRecordToWorkspaceUser(targetUserRecord);

  assertWorkspaceUserMutationAllowed({
    currentUserId: input.currentUserId,
    targetUser,
    users,
    workspaceRole: input.workspaceRole,
    disabled: input.disabled,
  });

  const nextRole = input.workspaceRole ?? targetUser.workspaceRole;
  const nextDisabled = input.disabled ?? (targetUser.accountStatus === "disabled");

  if (
    nextRole === targetUser.workspaceRole &&
    nextDisabled === (targetUser.accountStatus === "disabled")
  ) {
    return targetUser;
  }

  await applyWorkspaceUserMutation({
    userId: input.userId,
    appMetadata: targetUserRecord.raw_app_meta_data,
    workspaceRole: input.workspaceRole,
    disabled: input.disabled,
  });

  if (input.disabled) {
    await revokeWorkspaceUserSessions(input.userId);
  }

  return mapWorkspaceUserRecordToWorkspaceUser(
    await getWorkspaceUserRecordByIdOrThrow(input.userId),
  );
}

export async function sendWorkspaceUserPasswordResetEmail(input: {
  userId: string;
  redirectTo: string;
}) {
  const userRecord = await getWorkspaceUserRecordByIdOrThrow(input.userId);
  const targetUser = mapWorkspaceUserRecordToWorkspaceUser(userRecord);

  assertWorkspaceUserPasswordResetAllowed(targetUser);

  const admin = createSupabaseAdminClient();
  const resetResult = await admin.auth.resetPasswordForEmail(targetUser.email, {
    redirectTo: input.redirectTo,
  });

  if (resetResult.error) {
    throw resetResult.error;
  }
}
