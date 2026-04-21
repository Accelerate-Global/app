import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import {
  inviteWorkspaceUser,
  listWorkspaceUsers,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { workspaceUserInviteSchema } from "@/lib/validation";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage users");
  }

  try {
    const users = await listWorkspaceUsers();
    return Response.json({ users });
  } catch (error) {
    logError("Failed to list workspace users", error);
    return jsonError("Could not load users.", 500);
  }
}

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage users");
  }

  const parsed = workspaceUserInviteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("User invite payload is invalid.");
  }

  try {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set(
      "message",
      "Check your email to finish setting up your account.",
    );

    const user = await inviteWorkspaceUser({
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      workspaceRole: parsed.data.workspaceRole,
      redirectTo: redirectUrl.toString(),
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceUserPermissionError) {
      return jsonError(error.message, error.status);
    }

    logError("Failed to invite workspace user", error);
    return jsonError("Could not invite the user.", 500);
  }
}
