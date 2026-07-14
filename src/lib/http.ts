export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function jsonAdminOnlyError(action: string, status = 403) {
  return jsonError(`Only admins can ${action}.`, status);
}

function mergeVaryHeader(currentValue: string | null, requiredValues: string[]) {
  const values = new Map<string, string>();

  for (const value of [...(currentValue?.split(",") ?? []), ...requiredValues]) {
    const trimmed = value.trim();

    if (trimmed) {
      values.set(trimmed.toLowerCase(), trimmed);
    }
  }

  return [...values.values()].join(", ");
}

export function applyPrivateNoStoreHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set(
    "Vary",
    mergeVaryHeader(headers.get("Vary"), ["Cookie", "Authorization"]),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
