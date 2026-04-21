export type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeaderOptions = {
  nodeEnv: string | undefined;
  supabaseUrl?: string | undefined;
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

function buildContentSecurityPolicy(input: {
  isDevelopment: boolean;
  isProduction: boolean;
  supabaseOrigin: string | null;
}) {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'", "https://performance.typekit.net"];

  if (input.isDevelopment) {
    scriptSrc.push("https://va.vercel-scripts.com");
  }

  if (input.supabaseOrigin) {
    connectSrc.push(input.supabaseOrigin);
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

  if (input.isProduction) {
    directives.push(["upgrade-insecure-requests", ""]);
  }

  return directives
    .map(([directive, value]) => (value ? `${directive} ${value}` : directive))
    .join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): SecurityHeader[] {
  const isProduction = options.nodeEnv === "production";
  const isDevelopment = options.nodeEnv === "development";
  const supabaseOrigin = getOptionalOrigin(options.supabaseUrl);
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({
        isDevelopment,
        isProduction,
        supabaseOrigin,
      }),
    },
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
