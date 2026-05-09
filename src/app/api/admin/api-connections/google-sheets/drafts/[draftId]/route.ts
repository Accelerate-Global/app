import { getGoogleSheetsConnectionDraft } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type GoogleSheetsDraftContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export async function GET(_request: Request, context: GoogleSheetsDraftContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("connect Google Sheets");
  }

  const { draftId } = await context.params;

  try {
    const draft = await getGoogleSheetsConnectionDraft({ identity, draftId });

    if (!draft) {
      return jsonError("Google Sheets connection draft not found.", 404);
    }

    return Response.json({ draft });
  } catch (error) {
    logError("Failed to load Google Sheets draft", error);
    return jsonError("Could not load Google Sheets connection draft.", 500);
  }
}
