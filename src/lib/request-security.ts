import type { NextRequest } from "next/server";

const PROTECTED_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PROTECTED_MUTATION_ROUTE_KEYS = new Set(["POST /auth/sign-out"]);

type OriginValidationFailureReason =
  | "missing-origin"
  | "invalid-origin"
  | "origin-mismatch";

export type MutationOriginValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: OriginValidationFailureReason;
      expectedOrigin: string;
      receivedOrigin: string | null;
    };

function getSingleHeaderValue(headers: Headers, name: string) {
  const value = headers.get(name);

  if (!value) {
    return null;
  }

  return value
    .split(",")
    .map((token) => token.trim())
    .find(Boolean) ?? null;
}

function normalizeOrigin(origin: string) {
  return new URL(origin).origin;
}

export function isProtectedMutationRequest(request: Pick<NextRequest, "method" | "nextUrl">) {
  const method = request.method.toUpperCase();
  const { pathname } = request.nextUrl;

  return (
    PROTECTED_MUTATION_METHODS.has(method) &&
    ((pathname === "/api" || pathname.startsWith("/api/")) ||
      PROTECTED_MUTATION_ROUTE_KEYS.has(`${method} ${pathname}`))
  );
}

export function getEffectiveRequestOrigin(
  request: Pick<NextRequest, "headers" | "nextUrl">,
) {
  const forwardedProto = getSingleHeaderValue(request.headers, "x-forwarded-proto");
  const forwardedHost = getSingleHeaderValue(request.headers, "x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    try {
      return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    } catch {
      return request.nextUrl.origin;
    }
  }

  return request.nextUrl.origin;
}

export function validateMutationOrigin(
  request: Pick<NextRequest, "method" | "headers" | "nextUrl">,
): MutationOriginValidationResult {
  if (!isProtectedMutationRequest(request)) {
    return { ok: true };
  }

  const expectedOrigin = getEffectiveRequestOrigin(request);
  const rawOrigin = request.headers.get("origin");

  if (!rawOrigin) {
    return {
      ok: false,
      reason: "missing-origin",
      expectedOrigin,
      receivedOrigin: null,
    };
  }

  let receivedOrigin: string;

  try {
    receivedOrigin = normalizeOrigin(rawOrigin);
  } catch {
    return {
      ok: false,
      reason: "invalid-origin",
      expectedOrigin,
      receivedOrigin: rawOrigin,
    };
  }

  if (receivedOrigin !== expectedOrigin) {
    return {
      ok: false,
      reason: "origin-mismatch",
      expectedOrigin,
      receivedOrigin,
    };
  }

  return { ok: true };
}
