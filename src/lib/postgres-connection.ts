import type { Options } from "postgres";

type PostgresEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  "DATABASE_SSL_CA" | "NODE_ENV" | "VERCEL_ENV"
>>;

export type PostgresConnectionConfig = {
  databaseUrl: string;
  options: Pick<Options<Record<string, never>>, "ssl">;
};

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.startsWith("127.")
  );
}

function normalizeCertificate(value: string | undefined) {
  const certificate = value?.replace(/\\n/g, "\n").trim();

  if (!certificate) {
    return null;
  }

  if (
    !certificate.startsWith("-----BEGIN CERTIFICATE-----") ||
    !certificate.endsWith("-----END CERTIFICATE-----")
  ) {
    throw new Error("DATABASE_SSL_CA must contain a PEM-encoded certificate.");
  }

  return `${certificate}\n`;
}

export function getPostgresConnectionConfig(
  databaseUrl: string,
  environment: PostgresEnvironment = process.env,
): PostgresConnectionConfig {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }

  if (isLoopbackHost(parsedUrl.hostname)) {
    return {
      databaseUrl,
      options: { ssl: false },
    };
  }

  const certificate = normalizeCertificate(environment.DATABASE_SSL_CA);

  if (certificate) {
    return {
      databaseUrl,
      options: {
        ssl: {
          ca: certificate,
          rejectUnauthorized: true,
        },
      },
    };
  }

  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    throw new Error(
      "DATABASE_SSL_CA is required for certificate-verified production database connections.",
    );
  }

  return {
    databaseUrl,
    options: { ssl: "require" },
  };
}
