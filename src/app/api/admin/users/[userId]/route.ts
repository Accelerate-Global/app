import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import {
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

export async function PATCH(request: Request, context: UserContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage users");
  }

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
}
