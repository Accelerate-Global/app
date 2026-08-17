import { reconcileStaleApiConnectionRuns } from "@/lib/api-connections/durable-joshua";
import { logError } from "@/lib/error-logging";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return response({ ok: false, error: "Run reconciliation is not configured." }, 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const reconciled = await reconcileStaleApiConnectionRuns();
    return response({ ok: true, reconciled });
  } catch (error) {
    logError("API connection run reconciliation failed", error);
    return response({ ok: false, error: "Run reconciliation failed." }, 503);
  }
}
