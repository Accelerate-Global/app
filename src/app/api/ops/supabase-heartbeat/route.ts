import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const HEARTBEAT_TABLE = "field_definitions";
const HEARTBEAT_QUERY_COUNT = 3;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function getCronSecret() {
  return process.env.CRON_SECRET?.trim();
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...init?.headers,
    },
  });
}

export async function GET(request: Request) {
  const cronSecret = getCronSecret();

  if (!cronSecret) {
    return jsonResponse(
      { ok: false, error: "Supabase heartbeat is not configured." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  for (let queryIndex = 0; queryIndex < HEARTBEAT_QUERY_COUNT; queryIndex += 1) {
    const { error } = await supabase
      .from(HEARTBEAT_TABLE)
      .select("id")
      .limit(1);

    if (error) {
      logError("Supabase heartbeat failed", error);
      return jsonResponse(
        { ok: false, error: "Supabase heartbeat failed." },
        { status: 503 },
      );
    }
  }

  return jsonResponse({ ok: true });
}
