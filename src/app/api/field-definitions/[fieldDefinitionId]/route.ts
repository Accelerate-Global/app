import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { updateFieldDefinition } from "@/lib/field-definitions";
import { fieldDefinitionPatchSchema } from "@/lib/validation";

type FieldDefinitionContext = {
  params: Promise<{
    fieldDefinitionId: string;
  }>;
};

export async function PATCH(request: Request, context: FieldDefinitionContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage field definitions.", 403);
  }

  const parsed = fieldDefinitionPatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Field definition payload is invalid.");
  }

  const { fieldDefinitionId } = await context.params;
  const fieldDefinition = await updateFieldDefinition({
    fieldDefinitionId,
    displayLabel: parsed.data.displayLabel,
    definition: parsed.data.definition,
  });

  if (!fieldDefinition) {
    return jsonError("Field definition not found.", 404);
  }

  return Response.json({ fieldDefinition });
}
