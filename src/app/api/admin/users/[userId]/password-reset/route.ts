import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
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

export const POST = withRoute(
  { access: "admin", action: "manage users" },
  async (identity, request: Request, context: UserPasswordResetContext) => {
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
  },
);
