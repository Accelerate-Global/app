import { z } from "zod";

import {
  ApiConnectionError,
  checkGoogleSheetsConnectionAccess,
  disconnectGoogleSheetsConnection,
  previewExistingGoogleSheetsConnectionHeader,
  updateGoogleSheetsConnectionHeaderSelection,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type GoogleSheetsConnectionContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

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

export const GET = withRoute(
  { access: "admin", action: "check Google Sheets access" },
  async (
    identity,
    _request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const { connectionId } = await context.params;

    try {
      const result = await checkGoogleSheetsConnectionAccess({
        connectionId,
        identity,
      });

      if (!result) {
        return jsonError("Google Sheets connection not found.", 404);
      }

      return Response.json(result);
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      if (error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to check Google Sheets connection access", error);
      return jsonError("Could not check Google Sheets connection access.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "preview Google Sheets headers" },
  async (
    identity,
    request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const body = await request.json().catch(() => ({}));
    const parsed = z.object({ selection: selectionSchema.optional() }).safeParse(body);
    if (!parsed.success) {
      return jsonError("Google Sheets header preview request is invalid.");
    }
    const { connectionId } = await context.params;

    try {
      const preview = await previewExistingGoogleSheetsConnectionHeader({
        connectionId,
        identity,
        selection: parsed.data.selection,
      });
      return preview
        ? Response.json({ preview })
        : jsonError("Google Sheets connection not found.", 404);
    } catch (error) {
      if (error instanceof ApiConnectionError || error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to preview Google Sheets connection headers", error);
      return jsonError("Could not preview Google Sheets headers.", 500);
    }
  },
);

export const PATCH = withRoute(
  { access: "admin", action: "update Google Sheets headers" },
  async (
    identity,
    request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const body = await request.json().catch(() => null);
    const parsed = z.object({ selection: selectionSchema }).safeParse(body);
    if (!parsed.success) {
      return jsonError("Google Sheets header selection is invalid.");
    }
    const { connectionId } = await context.params;

    try {
      const result = await updateGoogleSheetsConnectionHeaderSelection({
        connectionId,
        identity,
        selection: parsed.data.selection,
      });
      return result
        ? Response.json(result)
        : jsonError("Google Sheets connection not found.", 404);
    } catch (error) {
      if (error instanceof ApiConnectionError || error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to update Google Sheets connection headers", error);
      return jsonError("Could not update Google Sheets headers.", 500);
    }
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "disconnect Google Sheets" },
  async (
    identity,
    _request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const { connectionId } = await context.params;

    try {
      const connection = await disconnectGoogleSheetsConnection({
        connectionId,
        identity,
      });

      if (!connection) {
        return jsonError("Google Sheets connection not found.", 404);
      }

      return Response.json({ connection });
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to disconnect Google Sheets connection", error);
      return jsonError("Could not disconnect Google Sheets connection.", 500);
    }
  },
);
