import { z } from "zod";

import { jsonError } from "@/lib/http";
import {
  createPrivateDataChatSemanticContextCandidateFromGuidingDocument,
  getActivePrivateDataChatSemanticContext,
} from "@/lib/private-data-chat/semantic-context-candidate";
import { ReferenceResourceValidationError } from "@/lib/reference-resources";
import { withRoute } from "@/lib/route-guard";

const updateSchema = z
  .object({
    document: z.string().min(1).max(1_000_000),
    expectedDefinitionPackageChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
    blakeApproved: z.literal(true),
  })
  .strict();

export const GET = withRoute(
  { access: "admin", action: "read semantic guiding documents" },
  async () => {
    const active = await getActivePrivateDataChatSemanticContext();
    return Response.json({
      document: active.payload.guidingDocument,
      definitionPackageChecksum: active.payload.definitionPackageChecksum,
      guidingDocumentChecksum: active.payload.guidingDocumentChecksum,
      version: active.version,
    });
  },
);

export const POST = withRoute(
  { access: "admin", action: "create semantic guiding-document candidates" },
  async (identity, request: Request) => {
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("The semantic guiding-document update is invalid.");
    }

    try {
      return Response.json(
        await createPrivateDataChatSemanticContextCandidateFromGuidingDocument({
          actorOwnerId: identity.ownerId,
          ...parsed.data,
        }),
      );
    } catch (error) {
      if (error instanceof ReferenceResourceValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }
  },
);
