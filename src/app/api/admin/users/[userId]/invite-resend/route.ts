import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  resendWorkspaceUserInviteEmail,
  WorkspaceUserActionError,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";

type UserInviteResendContext = {
  params: Promise<{
    userId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "manage users" },
  async (identity, request: Request, context: UserInviteResendContext) => {
    try {
      const { userId } = await context.params;
      const user = await resendWorkspaceUserInviteEmail({
        currentUserRole: identity.workspaceRole,
        userId,
        redirectTo: buildAuthConfirmUrl(
          new URL(request.url).origin,
          "/reset-password",
        ),
      });

      return Response.json({ user });
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

      logError("Failed to resend workspace user invite email", error);
      return jsonError("Could not resend the invite email.", 500);
    }
  },
);
