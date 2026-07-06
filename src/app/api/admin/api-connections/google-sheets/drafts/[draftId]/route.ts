import { getGoogleSheetsConnectionDraft } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type GoogleSheetsDraftContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async (identity, _request: Request, context: GoogleSheetsDraftContext) => {
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
  },
);
