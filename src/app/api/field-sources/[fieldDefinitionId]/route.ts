import { getCurrentIdentity } from "@/lib/auth";
import { updateFieldSourceValue } from "@/lib/field-sources";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { fieldSourcePatchSchema } from "@/lib/validation";

type FieldSourceContext = {
  params: Promise<{
    fieldDefinitionId: string;
  }>;
};

export async function PATCH(request: Request, context: FieldSourceContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage field sources");
  }

  const parsed = fieldSourcePatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Field source payload is invalid.");
  }

  const { fieldDefinitionId } = await context.params;
  const fieldSource = await updateFieldSourceValue({
    fieldDefinitionId,
    sourceTypeId: parsed.data.sourceTypeId,
    sourceFieldName: parsed.data.sourceFieldName,
  });

  if (!fieldSource) {
    return jsonError("Field source row not found.", 404);
  }

  return Response.json({ fieldSource });
}
