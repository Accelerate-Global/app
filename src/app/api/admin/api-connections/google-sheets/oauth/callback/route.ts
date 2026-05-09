import { NextResponse } from "next/server";

import {
  ApiConnectionError,
  completeGoogleSheetsConnectionOAuth,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";

function redirectToConnections(requestUrl: string, params: Record<string, string>) {
  const url = new URL("/dashboard/api-connections", requestUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity || !identity.isDatasetAdmin) {
    return redirectToConnections(request.url, { googleSheetError: "unauthorized" });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return redirectToConnections(request.url, { googleSheetError: error });
  }

  if (!code || !state) {
    return redirectToConnections(request.url, {
      googleSheetError: "missing_oauth_response",
    });
  }

  try {
    const draft = await completeGoogleSheetsConnectionOAuth({
      identity,
      code,
      state,
      requestUrl: request.url,
    });

    return redirectToConnections(request.url, { googleSheetDraft: draft.id });
  } catch (callbackError) {
    if (!(callbackError instanceof ApiConnectionError)) {
      logError("Failed to complete Google Sheets OAuth", callbackError);
    }

    return redirectToConnections(request.url, {
      googleSheetError: "oauth_callback_failed",
    });
  }
}
