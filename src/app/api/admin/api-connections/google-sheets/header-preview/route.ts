import { z } from "zod";

import {
  ApiConnectionError,
  previewGoogleSheetsConnectionHeader,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const selectionSchema = z
  .object({
    sheetId: z.number().int().nonnegative(),
    mode: z.enum(["auto", "manual"]),
    startRow: z.number().int().min(1).max(25),
    endRow: z.number().int().min(1).max(25),
  })
  .refine(
    (selection) =>
      selection.endRow >= selection.startRow &&
      selection.endRow - selection.startRow < 3,
  );

const headerPreviewSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1).max(2048),
  sheetId: z.number().int().nonnegative(),
  selection: selectionSchema.optional(),
});

export const POST = withRoute(
  { access: "admin", action: "preview Google Sheets headers" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    const parsed = headerPreviewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Google Sheets header preview request is invalid.");
    }

    try {
      const preview = await previewGoogleSheetsConnectionHeader({
        identity,
        spreadsheetUrl: parsed.data.spreadsheetUrl,
        sheetId: parsed.data.sheetId,
        selection: parsed.data.selection,
      });
      return Response.json({ preview });
    } catch (error) {
      if (error instanceof ApiConnectionError || error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to preview Google Sheets headers", error);
      return jsonError("Could not preview Google Sheets headers.", 500);
    }
  },
);
