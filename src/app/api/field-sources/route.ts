import { getCurrentIdentity } from "@/lib/auth";
import { listFieldSourceGridData } from "@/lib/field-sources";
import { jsonError } from "@/lib/http";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage field sources.", 403);
  }

  const fieldSources = await listFieldSourceGridData();
  return Response.json(fieldSources);
}
