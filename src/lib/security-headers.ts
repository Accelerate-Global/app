export type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeaderOptions = {
  nodeEnv: string | undefined;
};

function getOptionalOrigin(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createCspNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildContentSecurityPolicy(input: {
  nodeEnv: string | undefined;
  nonce: string;
  supabaseUrl?: string | undefined;
}) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(input.nonce)) {
    throw new Error("CSP nonce must be a base64-compatible value.");
  }

  const isDevelopment = input.nodeEnv === "development";
  const isProduction = input.nodeEnv === "production";
  const supabaseOrigin = getOptionalOrigin(input.supabaseUrl);
  const scriptSrc = ["'self'", `'nonce-${input.nonce}'`, "'strict-dynamic'"];
  const connectSrc = ["'self'", "https://performance.typekit.net"];

  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
  }

  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
  }

  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ["object-src", "'none'"],
    ["img-src", "'self' data: blob: https://p.typekit.net"],
    ["worker-src", "'self' blob:"],
    ["script-src", scriptSrc.join(" ")],
    ["style-src", "'self' 'unsafe-inline' https://use.typekit.net"],
    ["font-src", "'self' https://use.typekit.net data:"],
    ["connect-src", connectSrc.join(" ")],
    ["manifest-src", "'self'"],
  ];

  if (isProduction) {
    directives.push(["upgrade-insecure-requests", ""]);
  }

  return directives
    .map(([directive, value]) => (value ? `${directive} ${value}` : directive))
    .join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): SecurityHeader[] {
  const isProduction = options.nodeEnv === "production";
  const headers: SecurityHeader[] = [
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
