export const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";

function normalizeRelativeAppPath(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || !trimmedValue.startsWith("/") || trimmedValue.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(trimmedValue, "http://localhost");

    if (url.origin !== "http://localhost") {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function sanitizeAuthRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH,
) {
  return (
    normalizeRelativeAppPath(value) ??
    normalizeRelativeAppPath(fallback) ??
    DEFAULT_AUTH_REDIRECT_PATH
  );
}

export function buildAuthConfirmUrl(
  origin: string,
  next = DEFAULT_AUTH_REDIRECT_PATH,
) {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", sanitizeAuthRedirectPath(next));
  return url.toString();
}
