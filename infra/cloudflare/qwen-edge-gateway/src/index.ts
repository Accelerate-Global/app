const ORIGIN_BASE_URL = "https://samson.risencode.org";
const MAX_REQUEST_BYTES = 256_000;
const MAX_RESPONSE_BYTES = 128_000;

const POST_PATHS = new Set([
  "/v1/private-data-chat/plan",
  "/v1/private-data-chat/answer",
]);

const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "content-length",
  "content-type",
  "x-ag-nonce",
  "x-ag-signature",
  "x-ag-timestamp",
] as const;

const RESPONSE_HEADER_ALLOWLIST = [
  "cache-control",
  "content-length",
  "content-type",
  "retry-after",
] as const;

export interface PrivateQwenOrigin {
  fetch(
    resource: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: ArrayBuffer | null;
      redirect: "manual";
    },
  ): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    headers: { get(name: string): string | null };
    status: number;
    statusText: string;
  }>;
}

function jsonError(
  status: number,
  code: string,
  headers?: Record<string, string>,
) {
  return Response.json(
    { error: { code } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

function copyAllowedHeaders(
  source: { get(name: string): string | null },
  allowed: readonly string[],
) {
  const result = new Headers();
  for (const name of allowed) {
    const value = source.get(name);
    if (value !== null) {
      result.set(name, value);
    }
  }
  return result;
}

function copyAllowedRequestHeaders(
  source: Headers,
  allowed: readonly string[],
) {
  const result: Record<string, string> = {};
  for (const name of allowed) {
    const value = source.get(name);
    if (value !== null) {
      result[name] = value;
    }
  }
  return result;
}

function validateRequest(request: Request, url: URL): Response | null {
  if (url.search || url.hash) {
    return jsonError(404, "not_found");
  }

  if (url.pathname === "/health") {
    if (request.method !== "GET") {
      return jsonError(405, "method_not_allowed", { Allow: "GET" });
    }
    return null;
  }

  if (!POST_PATHS.has(url.pathname)) {
    return jsonError(404, "not_found");
  }

  if (request.method !== "POST") {
    return jsonError(405, "method_not_allowed", { Allow: "POST" });
  }

  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return jsonError(415, "invalid_request");
  }

  const contentLengthValue = request.headers.get("content-length");
  const contentLength = contentLengthValue === null
    ? Number.NaN
    : Number(contentLengthValue);
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > MAX_REQUEST_BYTES
  ) {
    return jsonError(413, "invalid_request");
  }

  for (const name of ["x-ag-timestamp", "x-ag-nonce", "x-ag-signature"]) {
    if (!request.headers.get(name)) {
      return jsonError(401, "unauthorized");
    }
  }

  return null;
}

export async function handlePrivateQwenEdgeRequest(
  request: Request,
  origin: PrivateQwenOrigin,
  now: () => number = Date.now,
) {
  const startedAt = now();
  const url = new URL(request.url);
  const invalid = validateRequest(request, url);
  if (invalid) {
    return invalid;
  }

  const originHeaders = copyAllowedRequestHeaders(
    request.headers,
    REQUEST_HEADER_ALLOWLIST,
  );
  const body = request.method === "POST" ? await request.arrayBuffer() : null;
  if (
    body !== null &&
    body.byteLength !== Number(request.headers.get("content-length"))
  ) {
    return jsonError(400, "invalid_request");
  }
  try {
    const response = await origin.fetch(`${ORIGIN_BASE_URL}${url.pathname}`, {
      method: request.method,
      headers: originHeaders,
      body,
      redirect: "manual",
    });
    const declaredResponseBytesValue = response.headers.get("content-length");
    const declaredResponseBytes = declaredResponseBytesValue === null
      ? Number.NaN
      : Number(declaredResponseBytesValue);
    if (
      !Number.isSafeInteger(declaredResponseBytes) ||
      declaredResponseBytes < 0 ||
      declaredResponseBytes > MAX_RESPONSE_BYTES
    ) {
      return jsonError(502, "invalid_response");
    }
    const responseBody = await response.arrayBuffer();
    if (
      responseBody.byteLength !== declaredResponseBytes ||
      responseBody.byteLength > MAX_RESPONSE_BYTES
    ) {
      return jsonError(502, "invalid_response");
    }
    const responseHeaders = copyAllowedHeaders(
      response.headers,
      RESPONSE_HEADER_ALLOWLIST,
    );
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Content-Length", String(responseBody.byteLength));

    console.log(
      JSON.stringify({
        event: "private_qwen_edge_request",
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Math.max(0, now() - startedAt),
      }),
    );

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "private_qwen_edge_failure",
        method: request.method,
        path: url.pathname,
        durationMs: Math.max(0, now() - startedAt),
      }),
    );
    return jsonError(503, "unavailable", { "Retry-After": "5" });
  }
}

const worker = {
  fetch(request: Request, env: QwenEdgeEnv) {
    return handlePrivateQwenEdgeRequest(request, env.PRIVATE_QWEN);
  },
};

export default worker;
