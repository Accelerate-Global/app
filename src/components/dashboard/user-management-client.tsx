"use client";

import {
  CopyIcon,
  Loader2Icon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  WorkspaceUser,
  WorkspaceUserAccountStatus,
  WorkspaceUserResponse,
} from "@/lib/api-types";
import type { WorkspaceRole } from "@/lib/workspace-role";

type UserManagementClientProps = {
  currentUserId: string;
  initialUsers: WorkspaceUser[];
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: "Admin",
  viewer: "Viewer",
};

const STATUS_LABELS: Record<WorkspaceUserAccountStatus, string> = {
  active: "Active",
  pending_invite: "Pending invite",
  pending_confirmation: "Pending confirmation",
  disabled: "Disabled",
};

const STATUS_BADGE_VARIANTS: Record<
  WorkspaceUserAccountStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  pending_invite: "secondary",
  pending_confirmation: "outline",
  disabled: "destructive",
};

function sortUsers(users: WorkspaceUser[]) {
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUserDisplayName(user: WorkspaceUser) {
  return user.fullName ?? user.email?.split("@")[0] ?? "Unnamed user";
}

function getUserSearchText(user: WorkspaceUser) {
  return [user.fullName, user.email, user.id].filter(Boolean).join(" ").toLowerCase();
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function inviteUser(input: {
  email: string;
  fullName: string;
  workspaceRole: WorkspaceRole;
}) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The user could not be invited."));
  }

  return ((await response.json()) as WorkspaceUserResponse).user;
}

async function updateUserRecord(input: {
  userId: string;
  workspaceRole?: WorkspaceRole;
  disabled?: boolean;
}) {
  const response = await fetch(`/api/admin/users/${input.userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceRole: input.workspaceRole,
      disabled: input.disabled,
    }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The user could not be updated."));
  }

  return ((await response.json()) as WorkspaceUserResponse).user;
}

async function sendUserPasswordResetEmail(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}/password-reset`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The password reset email could not be sent."),
    );
  }
}

function replaceUser(users: WorkspaceUser[], nextUser: WorkspaceUser) {
  const hasUser = users.some((user) => user.id === nextUser.id);
  return sortUsers(
    hasUser
      ? users.map((user) => (user.id === nextUser.id ? nextUser : user))
      : [nextUser, ...users],
  );
}

export function UserManagementClient({
  currentUserId,
  initialUsers,
}: UserManagementClientProps) {
  const [users, setUsers] = useState(() => sortUsers(initialUsers));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUsers[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<
    WorkspaceUserAccountStatus | "all"
  >("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("viewer");
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>("viewer");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdatingUserId, setIsUpdatingUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "all" && user.workspaceRole !== roleFilter) {
        return false;
      }

      if (statusFilter !== "all" && user.accountStatus !== statusFilter) {
        return false;
      }

      if (normalizedSearch && !getUserSearchText(user).includes(normalizedSearch)) {
        return false;
      }

      return true;
    });
  }, [roleFilter, searchQuery, statusFilter, users]);

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ??
    users.find((user) => user.id === selectedUserId) ??
    filteredUsers[0] ??
    users[0] ??
    null;
  const activeAdminCount = useMemo(
    () =>
      users.filter(
        (user) =>
          user.workspaceRole === "admin" &&
          user.accountStatus !== "disabled",
      ).length,
    [users],
  );
  const disabledUserCount = useMemo(
    () => users.filter((user) => user.accountStatus === "disabled").length,
    [users],
  );

  useEffect(() => {
    if (!selectedUserId && filteredUsers[0]) {
      setSelectedUserId(filteredUsers[0].id);
      return;
    }

    if (
      selectedUserId &&
      !users.some((user) => user.id === selectedUserId) &&
      filteredUsers[0]
    ) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId, users]);

  useEffect(() => {
    if (selectedUser) {
      setSelectedRole(selectedUser.workspaceRole);
    }
  }, [selectedUser]);

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(`${label} copied.`);
    } catch {
      setErrorMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function handleInviteUser() {
    const email = inviteEmail.trim();

    if (!email) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsInviting(true);

    try {
      const user = await inviteUser({
        email,
        fullName: inviteFullName.trim(),
        workspaceRole: inviteRole,
      });

      setUsers((current) => replaceUser(current, user));
      setSelectedUserId(user.id);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("viewer");
      setSuccessMessage(`Invitation sent to ${user.email ?? "the new user"}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The user could not be invited.",
      );
    } finally {
      setIsInviting(false);
    }
  }

  async function handleSaveRole() {
    if (!selectedUser || selectedRole === selectedUser.workspaceRole) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUpdatingUserId(selectedUser.id);

    try {
      const user = await updateUserRecord({
        userId: selectedUser.id,
        workspaceRole: selectedRole,
      });

      setUsers((current) => replaceUser(current, user));
      setSuccessMessage(`${getUserDisplayName(user)} is now ${ROLE_LABELS[user.workspaceRole].toLowerCase()}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The user role could not be updated.",
      );
    } finally {
      setIsUpdatingUserId(null);
    }
  }

  async function handleSetDisabled(disabled: boolean) {
    if (!selectedUser) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUpdatingUserId(selectedUser.id);

    try {
      const user = await updateUserRecord({
        userId: selectedUser.id,
        disabled,
      });

      setUsers((current) => replaceUser(current, user));
      setSuccessMessage(
        disabled
          ? `${getUserDisplayName(user)} was disabled.`
          : `${getUserDisplayName(user)} was re-enabled.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The user status could not be updated.",
      );
    } finally {
      setIsUpdatingUserId(null);
    }
  }

  async function handleSendPasswordResetEmail() {
    if (!selectedUser?.email) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUpdatingUserId(selectedUser.id);

    try {
      await sendUserPasswordResetEmail(selectedUser.id);
      setSuccessMessage(`Password reset email sent to ${selectedUser.email}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The password reset email could not be sent.",
      );
    } finally {
      setIsUpdatingUserId(null);
    }
  }

  const isCurrentUserSelected = selectedUser?.id === currentUserId;
  const removesLastActiveAdmin =
    selectedUser?.workspaceRole === "admin" &&
    selectedUser.accountStatus !== "disabled" &&
    activeAdminCount <= 1;
  const isSelectedUserBusy = selectedUser?.id === isUpdatingUserId;
  const canSaveRole =
    Boolean(selectedUser) &&
    !isCurrentUserSelected &&
    !isSelectedUserBusy &&
    selectedRole !== selectedUser.workspaceRole &&
    !(selectedUser.workspaceRole === "admin" && selectedRole === "viewer" && removesLastActiveAdmin);
  const canDisableSelectedUser =
    Boolean(selectedUser) &&
    !isCurrentUserSelected &&
    !isSelectedUserBusy &&
    selectedUser.accountStatus !== "disabled" &&
    !removesLastActiveAdmin;
  const canEnableSelectedUser =
    Boolean(selectedUser) &&
    !isCurrentUserSelected &&
    !isSelectedUserBusy &&
    selectedUser.accountStatus === "disabled";
  const canSendSelectedUserPasswordReset =
    Boolean(selectedUser) &&
    !isSelectedUserBusy &&
    Boolean(selectedUser.email) &&
    selectedUser.accountStatus !== "disabled";

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total users</CardTitle>
            <CardDescription>All workspace accounts in Supabase Auth.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-[-0.04em]">{users.length}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Active admins</CardTitle>
            <CardDescription>Admins who can still access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-[-0.04em]">{activeAdminCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Disabled accounts</CardTitle>
            <CardDescription>Users currently blocked from signing in.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-[-0.04em]">{disabledUserCount}</p>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlusIcon className="size-5 text-muted-foreground" />
            Invite user
          </CardTitle>
          <CardDescription>
            Add the email to the allowlist and send a Supabase invite.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr_0.75fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              placeholder="name@example.com"
              disabled={isInviting}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={inviteFullName}
              placeholder="Optional"
              disabled={isInviting}
              onChange={(event) => setInviteFullName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={inviteRole}
              onValueChange={(value) => setInviteRole(value as WorkspaceRole)}
            >
              <SelectTrigger id="invite-role" className="w-full justify-between">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={isInviting || !inviteEmail.trim()}
            onClick={() => {
              void handleInviteUser();
            }}
          >
            {isInviting ? <Loader2Icon className="animate-spin" /> : null}
            Invite user
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(20rem,1fr)]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <UsersIcon className="size-5 text-muted-foreground" />
                  Users
                </CardTitle>
                <CardDescription>
                  Search, filter, and inspect every workspace account.
                </CardDescription>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={searchQuery}
                  placeholder="Search name, email, or id"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <Select
                  value={roleFilter}
                  onValueChange={(value) =>
                    setRoleFilter(value as WorkspaceRole | "all")
                  }
                >
                  <SelectTrigger className="w-full justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="viewer">Viewers</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as WorkspaceUserAccountStatus | "all")
                  }
                >
                  <SelectTrigger className="w-full justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_invite">Pending invite</SelectItem>
                    <SelectItem value="pending_confirmation">
                      Pending confirmation
                    </SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                No users match the current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isSelected = user.id === selectedUser?.id;

                    return (
                      <TableRow
                        key={user.id}
                        data-state={isSelected ? "selected" : undefined}
                      >
                        <TableCell className="min-w-56">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {getUserDisplayName(user)}
                            </span>
                            <span className="text-muted-foreground">
                              {user.email ?? user.id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{ROLE_LABELS[user.workspaceRole]}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANTS[user.accountStatus]}>
                            {STATUS_LABELS[user.accountStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant={isSelected ? "secondary" : "ghost"}
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {selectedUser ? getUserDisplayName(selectedUser) : "User details"}
            </CardTitle>
            <CardDescription>
              {selectedUser
                ? "Review identifiers, providers, access level, and account status."
                : "Select a user to inspect and manage their account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {selectedUser ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge>{ROLE_LABELS[selectedUser.workspaceRole]}</Badge>
                  <Badge variant={STATUS_BADGE_VARIANTS[selectedUser.accountStatus]}>
                    {STATUS_LABELS[selectedUser.accountStatus]}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Email
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="break-all text-foreground">
                        {selectedUser.email ?? "—"}
                      </p>
                      {selectedUser.email ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void copyValue(selectedUser.email!, "Email");
                          }}
                        >
                          <CopyIcon />
                          Copy
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      User ID
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="break-all text-foreground">{selectedUser.id}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void copyValue(selectedUser.id, "User ID");
                        }}
                      >
                        <CopyIcon />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Created
                      </p>
                      <p>{formatDate(selectedUser.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Last login
                      </p>
                      <p>{formatDate(selectedUser.lastLoginAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Invite sent
                      </p>
                      <p>{formatDate(selectedUser.invitedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Email confirmed
                      </p>
                      <p>{formatDate(selectedUser.emailConfirmedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Providers
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.providers.length > 0 ? (
                      selectedUser.providers.map((provider) => (
                        <Badge key={provider} variant="outline">
                          {provider}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No identities linked.</span>
                    )}
                  </div>
                  {selectedUser.identities.length > 0 ? (
                    <div className="grid gap-2 rounded-xl border border-border p-3 text-sm">
                      {selectedUser.identities.map((identity) => (
                        <div key={identity.id} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {identity.provider}
                            </p>
                            <p className="text-muted-foreground">{identity.id}</p>
                          </div>
                          <p className="text-right text-muted-foreground">
                            {formatDate(identity.lastLoginAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 rounded-2xl border border-border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="selected-user-role">Role</Label>
                    <Select
                      value={selectedRole}
                      onValueChange={(value) => setSelectedRole(value as WorkspaceRole)}
                    >
                      <SelectTrigger
                        id="selected-user-role"
                        className="w-full justify-between"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!canSaveRole}
                      onClick={() => {
                        void handleSaveRole();
                      }}
                    >
                      {isSelectedUserBusy ? <Loader2Icon className="animate-spin" /> : <ShieldIcon />}
                      Save role
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!canSendSelectedUserPasswordReset}
                      onClick={() => {
                        void handleSendPasswordResetEmail();
                      }}
                    >
                      {isSelectedUserBusy ? <Loader2Icon className="animate-spin" /> : null}
                      Send password reset email
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full"
                      disabled={!canDisableSelectedUser}
                      onClick={() => {
                        void handleSetDisabled(true);
                      }}
                    >
                      {isSelectedUserBusy ? <Loader2Icon className="animate-spin" /> : null}
                      Disable account
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!canEnableSelectedUser}
                      onClick={() => {
                        void handleSetDisabled(false);
                      }}
                    >
                      {isSelectedUserBusy ? <Loader2Icon className="animate-spin" /> : null}
                      Re-enable account
                    </Button>
                  </div>

                  {!selectedUser.email ? (
                    <p className="text-sm text-muted-foreground">
                      This account cannot receive a password reset email because no email address
                      is stored.
                    </p>
                  ) : null}

                  {selectedUser.accountStatus === "disabled" ? (
                    <p className="text-sm text-muted-foreground">
                      Re-enable the account before sending a password reset email.
                    </p>
                  ) : null}

                  {isCurrentUserSelected ? (
                    <p className="text-sm text-muted-foreground">
                      Use your Profile page for your own account changes.
                    </p>
                  ) : null}

                  {!isCurrentUserSelected && removesLastActiveAdmin ? (
                    <p className="text-sm text-muted-foreground">
                      This account is the last active admin and cannot be demoted or disabled.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                No user selected.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
