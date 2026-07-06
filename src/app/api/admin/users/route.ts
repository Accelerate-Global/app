import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  inviteWorkspaceUser,
  listWorkspaceUsers,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { workspaceUserInviteSchema } from "@/lib/validation";

export const GET = withRoute(
  { access: "admin", action: "manage users" },
  async () => {
    try {
      const users = await listWorkspaceUsers();
      return Response.json({ users });
    } catch (error) {
      logError("Failed to list workspace users", error);
      return jsonError("Could not load users.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "manage users" },
  async (identity, request: Request) => {
    const parsed = workspaceUserInviteSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("User invite payload is invalid.");
    }

    try {
      const redirectUrl = buildAuthConfirmUrl(
        new URL(request.url).origin,
        "/reset-password",
      );

      const user = await inviteWorkspaceUser({
        currentUserRole: identity.workspaceRole,
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        workspaceRole: parsed.data.workspaceRole,
        redirectTo: redirectUrl,
      });

      return Response.json({ user }, { status: 201 });
    } catch (error) {
      if (error instanceof WorkspaceUserPermissionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to invite workspace user", error);
      return jsonError("Could not invite the user.", 500);
    }
  },
);
