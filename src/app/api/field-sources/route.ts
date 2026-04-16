import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage field sources");
  }

  const fieldSources = await listFieldSourceGridData();
  return Response.json(fieldSources);
}
