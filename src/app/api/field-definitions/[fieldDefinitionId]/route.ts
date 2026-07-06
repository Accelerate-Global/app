import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { updateFieldDefinition } from "@/lib/field-definitions";
import { fieldDefinitionPatchSchema } from "@/lib/validation";

type FieldDefinitionContext = {
  params: Promise<{
    fieldDefinitionId: string;
  }>;
};

export const PATCH = withRoute(
  { access: "admin", action: "manage field definitions" },
  async (_identity, request: Request, context: FieldDefinitionContext) => {
    const parsed = fieldDefinitionPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Field definition payload is invalid.");
    }

    const { fieldDefinitionId } = await context.params;
    const fieldDefinition = await updateFieldDefinition({
      fieldDefinitionId,
      displayLabel: parsed.data.displayLabel,
      definition: parsed.data.definition,
      hideFromViewerFieldDefinitions:
        parsed.data.hideFromViewerFieldDefinitions,
    });

    if (!fieldDefinition) {
      return jsonError("Field definition not found.", 404);
    }

    return Response.json({ fieldDefinition });
  },
);
