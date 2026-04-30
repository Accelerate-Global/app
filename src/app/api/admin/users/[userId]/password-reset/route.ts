import { getCurrentIdentity } from "@/lib/auth";
import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import {
  sendWorkspaceUserPasswordResetEmail,
  WorkspaceUserActionError,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";

type UserPasswordResetContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: Request, context: UserPasswordResetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage users");
  }

  try {
    const { userId } = await context.params;

    await sendWorkspaceUserPasswordResetEmail({
      currentUserRole: identity.workspaceRole,
      userId,
      redirectTo: buildAuthConfirmUrl(
        new URL(request.url).origin,
        "/reset-password",
      ),
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof WorkspaceUserNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof WorkspaceUserActionError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof WorkspaceUserPermissionError) {
      return jsonError(error.message, error.status);
    }

    logError("Failed to send workspace user password reset email", error);
    return jsonError("Could not send the password reset email.", 500);
  }
}
