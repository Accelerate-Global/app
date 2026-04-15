import { getCurrentIdentity } from "@/lib/auth";
import {
  createFieldSourceType,
  FieldSourceTypeConflictError,
} from "@/lib/field-sources";
import { jsonError } from "@/lib/http";
import { fieldSourceTypeCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage field sources.", 403);
  }

  const parsed = fieldSourceTypeCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Field source type payload is invalid.");
  }

  try {
    const fieldSourceType = await createFieldSourceType(parsed.data);
    return Response.json({ fieldSourceType }, { status: 201 });
  } catch (error) {
    if (error instanceof FieldSourceTypeConflictError) {
      return jsonError(error.message, 409);
    }

    throw error;
  }
}
