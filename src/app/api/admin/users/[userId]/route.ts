import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  deleteWorkspaceUser,
  updateWorkspaceUser,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { workspaceUserPatchSchema } from "@/lib/validation";

type UserContext = {
  params: Promise<{
    userId: string;
  }>;
};

export const PATCH = withRoute(
  { access: "admin", action: "manage users" },
  async (identity, request: Request, context: UserContext) => {
    const parsed = workspaceUserPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("User update payload is invalid.");
    }

    try {
      const { userId } = await context.params;
      const user = await updateWorkspaceUser({
        currentUserId: identity.ownerId,
        currentUserRole: identity.workspaceRole,
        userId,
        workspaceRole: parsed.data.workspaceRole,
        disabled: parsed.data.disabled,
      });

      return Response.json({ user });
    } catch (error) {
      if (error instanceof WorkspaceUserNotFoundError) {
        return jsonError(error.message, 404);
      }

      if (error instanceof WorkspaceUserPermissionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to update workspace user", error);
      return jsonError("Could not update the user.", 500);
    }
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "delete users" },
  async (identity, _request: Request, context: UserContext) => {
    try {
      const { userId } = await context.params;
      const user = await deleteWorkspaceUser({
        currentUserId: identity.ownerId,
        currentUserRole: identity.workspaceRole,
        userId,
      });

      return Response.json({ deletedUserId: user.id });
    } catch (error) {
      if (error instanceof WorkspaceUserNotFoundError) {
        return jsonError(error.message, 404);
      }

      if (error instanceof WorkspaceUserPermissionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to delete workspace user", error);
      return jsonError("Could not delete the user.", 500);
    }
  },
);
