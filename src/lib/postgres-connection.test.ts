import { describe, expect, it } from "vitest";

import { getPostgresConnectionConfig } from "@/lib/postgres-connection";

const certificate = [
  "-----BEGIN CERTIFICATE-----",
  "dGVzdA==",
  "-----END CERTIFICATE-----",
].join("\n");

describe("getPostgresConnectionConfig", () => {
  it.each([
    "postgresql://postgres:postgres@localhost:54322/postgres",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgresql://postgres:postgres@[::1]:54322/postgres",
  ])("keeps loopback database connections unencrypted: %s", (databaseUrl) => {
    expect(getPostgresConnectionConfig(databaseUrl, {})).toEqual({
      databaseUrl,
      options: { ssl: false },
    });
  });

  it("encrypts non-production remote connections when no CA is configured", () => {
    const databaseUrl = "postgresql://user:secret@db.example.com:5432/app";

    expect(getPostgresConnectionConfig(databaseUrl, {})).toEqual({
      databaseUrl,
      options: { ssl: "require" },
    });
  });

  it("uses strict certificate verification when a CA is configured", () => {
    const databaseUrl = "postgresql://user:secret@db.example.com:5432/app";

    expect(
      getPostgresConnectionConfig(databaseUrl, {
        DATABASE_SSL_CA: certificate.replace(/\n/g, "\\n"),
        NODE_ENV: "production",
      }),
    ).toEqual({
      databaseUrl,
      options: {
        ssl: {
          ca: `${certificate}\n`,
          rejectUnauthorized: true,
        },
      },
    });
  });

  it.each([
    { NODE_ENV: "production" as const },
    { VERCEL_ENV: "production" },
  ])("rejects unverifiable production connections", (environment) => {
    expect(() =>
      getPostgresConnectionConfig(
        "postgresql://user:secret@db.example.com:5432/app",
        environment,
      ),
    ).toThrow(/DATABASE_SSL_CA is required/);
  });

  it("rejects malformed certificates", () => {
    expect(() =>
      getPostgresConnectionConfig(
        "postgresql://user:secret@db.example.com:5432/app",
        { DATABASE_SSL_CA: "not a certificate" },
      ),
    ).toThrow(/PEM-encoded certificate/);
  });

  it.each(["not a url", "https://db.example.com/app"])(
    "rejects invalid database URLs: %s",
    (databaseUrl) => {
      expect(() => getPostgresConnectionConfig(databaseUrl, {})).toThrow(
        /DATABASE_URL/,
      );
    },
  );
});
