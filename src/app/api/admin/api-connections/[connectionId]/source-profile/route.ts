import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  SourceProfileBindingConflictError,
  getSourceProfileBinding,
  removeSourceProfileBinding,
  resolveSourceProfile,
  upsertSourceProfileBinding,
} from "@/lib/source-profiles";
import { sourceProfileBindingInputSchema } from "@/lib/source-profiles/schemas";

type Context = { params: Promise<{ connectionId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view source profile bindings" },
  async (_identity, _request: Request, context: Context) => {
    const { connectionId } = await context.params;
    try {
      return Response.json({
        binding: await getSourceProfileBinding(connectionId),
        profile: await resolveSourceProfile(connectionId),
      });
    } catch (error) {
      logError("Failed to load source profile binding", error);
      return jsonError("Could not load the source profile binding.", 500);
    }
  },
);

export const PUT = withRoute(
  { access: "admin", action: "configure source profile bindings" },
  async (identity, request: Request, context: Context) => {
    const { connectionId } = await context.params;
    const parsed = sourceProfileBindingInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Choose a supported profile and durable stable-key column.", 400);
    }
    try {
      const binding = await upsertSourceProfileBinding({
        connectionId,
        actorOwnerId: identity.ownerId,
        ...parsed.data,
      });
      return Response.json({
        binding,
        profile: await resolveSourceProfile(connectionId),
      });
    } catch (error) {
      logError("Failed to configure source profile binding", error);
      if (error instanceof SourceProfileBindingConflictError) {
        return jsonError(
          "That source profile is already assigned to another dataset connection. Remove the existing assignment before reassigning it.",
          409,
        );
      }
      return jsonError(
        "The source profile could not be configured. Verify the active connection and profile settings.",
        409,
      );
    }
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "remove source profile bindings" },
  async (_identity, _request: Request, context: Context) => {
    const { connectionId } = await context.params;
    try {
      const binding = await removeSourceProfileBinding(connectionId);
      return binding
        ? Response.json({ binding })
        : jsonError("Source profile binding not found.", 404);
    } catch (error) {
      logError("Failed to remove source profile binding", error);
      return jsonError("Could not remove the source profile binding.", 500);
    }
  },
);
