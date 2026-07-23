import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseLegacyAxIdentityGraphManifest } from "@/lib/identity-registry/importer";

import {
  assertSupabaseDatabaseProjectMatch,
  createLegacyAxCommitToken,
  createLegacyAxEvidenceFingerprint,
  getLegacyAxDatabaseConnectionConfig,
  inspectLegacyAxTier2ProfileMappings,
  parseLegacyAxIdentityGraphImportArguments,
} from "./import-legacy-ax-identity-graph";

const fingerprint = "a".repeat(64);
const token = "b".repeat(43);

describe("legacy AX identity graph import CLI", () => {
  it("parses explicit local dry-runs and remote commits", () => {
    expect(
      parseLegacyAxIdentityGraphImportArguments([
        "--local",
        "--ax-data-root",
        "../data",
      ]),
    ).toMatchObject({
      environment: "local",
      axDataRoot: "../data",
      commit: false,
      fingerprint: null,
      token: null,
    });

    expect(
      parseLegacyAxIdentityGraphImportArguments([
        "--remote",
        "--ax-data-root",
        "/pinned/ax",
        "--manifest",
        "/pinned/manifest.json",
        "--commit",
        "--fingerprint",
        fingerprint,
        "--token",
        token,
        "--reason",
        "Approved production cutover",
      ]),
    ).toMatchObject({
      environment: "remote",
      axDataRoot: "/pinned/ax",
      manifestPath: "/pinned/manifest.json",
      commit: true,
      fingerprint,
      token,
      reason: "Approved production cutover",
    });
  });

  it.each([
    { args: [], message: "exactly one" },
    { args: ["--local", "--remote", "--ax-data-root", "../data"], message: "exactly one" },
    { args: ["--local"], message: "--ax-data-root is required" },
    {
      args: ["--local", "--ax-data-root", "../data", "--commit"],
      message: "--fingerprint",
    },
    {
      args: [
        "--local",
        "--ax-data-root",
        "../data",
        "--commit",
        "--fingerprint",
        fingerprint,
      ],
      message: "--token",
    },
    {
      args: [
        "--local",
        "--ax-data-root",
        "../data",
        "--commit",
        "--fingerprint",
        fingerprint,
        "--token",
        "too-short",
        "--reason",
        "Cut over",
      ],
      message: "--token",
    },
    {
      args: ["--local", "--ax-data-root", "../data", "--reason", "Not a commit"],
      message: "commit-only",
    },
    {
      args: ["--local", "--ax-data-root", "../data", "--latest"],
      message: "Unknown argument",
    },
    {
      args: ["--local", "--local", "--ax-data-root", "../data"],
      message: "only once",
    },
  ])("fails closed for unsafe argument combinations", ({ args, message }) => {
    expect(() => parseLegacyAxIdentityGraphImportArguments(args)).toThrow(message);
  });

  it("binds a deterministic commit token to secret, input, state, and graph", () => {
    const base = {
      tokenSecret: "environment-secret",
      inputFingerprint: "1".repeat(64),
      stateFingerprint: "2".repeat(64),
      graphChecksum: "3".repeat(64),
    };
    const expected = createLegacyAxCommitToken(base);
    expect(createLegacyAxCommitToken(base)).toBe(expected);
    expect(expected).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(createLegacyAxCommitToken({ ...base, tokenSecret: "other-secret" })).not.toBe(expected);
    expect(
      createLegacyAxCommitToken({ ...base, inputFingerprint: "4".repeat(64) }),
    ).not.toBe(expected);
    expect(
      createLegacyAxCommitToken({ ...base, stateFingerprint: "5".repeat(64) }),
    ).not.toBe(expected);
    expect(
      createLegacyAxCommitToken({ ...base, graphChecksum: "6".repeat(64) }),
    ).not.toBe(expected);
  });

  it("creates a fresh evidence fingerprint after database remediation or report changes", () => {
    const base = {
      sourceInputFingerprint: "1".repeat(64),
      stateFingerprint: "2".repeat(64),
      graphChecksum: "3".repeat(64),
      reportChecksum: "4".repeat(64),
    };
    const blocked = createLegacyAxEvidenceFingerprint(base);
    expect(createLegacyAxEvidenceFingerprint(base)).toBe(blocked);
    expect(
      createLegacyAxEvidenceFingerprint({ ...base, stateFingerprint: "5".repeat(64) }),
    ).not.toBe(blocked);
    expect(
      createLegacyAxEvidenceFingerprint({ ...base, reportChecksum: "6".repeat(64) }),
    ).not.toBe(blocked);
  });

  it("rejects duplicate and wrong-spreadsheet Tier 2 profile mappings", async () => {
    const raw = JSON.parse(
      await readFile("config/legacy-ax-identity-import-manifest.json", "utf8"),
    ) as {
      tier2Components: Record<string, { expectedRowCount: number; profileKey: string | null }>;
    };
    const spreadsheetComponents = Object.keys(raw.tier2Components).filter((component) =>
      component.startsWith("spreadsheet:"),
    );
    raw.tier2Components[spreadsheetComponents[0]!]!.profileKey = "partner-one";
    raw.tier2Components[spreadsheetComponents[1]!]!.profileKey = "partner-one";
    const manifest = parseLegacyAxIdentityGraphManifest(raw);
    const validation = inspectLegacyAxTier2ProfileMappings({
      manifest,
      profiles: [
        {
          profile_key: "partner-one",
          partner_key: "one",
          api_connection_id: "88000000-0000-4000-8000-000000000001",
          spreadsheet_id: "wrong-spreadsheet",
          sheet_id: 1,
          contract_version: "v1",
          contract_checksum: "a".repeat(64),
          active: true,
          connection_provider: "google_sheets",
          connection_provider_config: {
            spreadsheetId: "wrong-spreadsheet",
            sheetId: 1,
          },
          connection_archived_at: null,
        },
      ],
    });

    expect(validation.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("mapped from more than one component"),
        expect.stringContaining("does not match profile partner-one's spreadsheet ID"),
      ]),
    );
  });

  it("blocks archived or source-mismatched Tier 2 connections", async () => {
    const raw = JSON.parse(
      await readFile("config/legacy-ax-identity-import-manifest.json", "utf8"),
    ) as {
      tier2Components: Record<string, { expectedRowCount: number; profileKey: string | null }>;
    };
    const component = Object.keys(raw.tier2Components).find((entry) =>
      entry.startsWith("spreadsheet:"),
    )!;
    const spreadsheetId = component.slice("spreadsheet:".length);
    raw.tier2Components[component]!.profileKey = "partner-archived";
    const validation = inspectLegacyAxTier2ProfileMappings({
      manifest: parseLegacyAxIdentityGraphManifest(raw),
      profiles: [
        {
          profile_key: "partner-archived",
          partner_key: "archived",
          api_connection_id: "88000000-0000-4000-8000-000000000002",
          spreadsheet_id: spreadsheetId,
          sheet_id: 42,
          contract_version: "v1",
          contract_checksum: "b".repeat(64),
          active: true,
          connection_provider: "google_sheets",
          connection_provider_config: { spreadsheetId, sheetId: 99 },
          connection_archived_at: "2026-07-22T00:00:00.000Z",
        },
      ],
    });

    expect(validation.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("active Google Sheets connection"),
        expect.stringContaining("exact Sheet identity"),
      ]),
    );
  });

  it("fails before upload when Supabase API and database projects differ", () => {
    expect(() =>
      assertSupabaseDatabaseProjectMatch({
        environment: "remote",
        supabaseUrl: "https://projectone.supabase.co",
        databaseUrl: "postgresql://postgres.projecttwo:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
      }),
    ).toThrow("same project");
    expect(() =>
      assertSupabaseDatabaseProjectMatch({
        environment: "remote",
        supabaseUrl: "https://projectone.supabase.co",
        databaseUrl: "postgresql://postgres.projectone:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
      }),
    ).not.toThrow();
    expect(() =>
      assertSupabaseDatabaseProjectMatch({
        environment: "remote",
        supabaseUrl: "https://projectone.supabase.co",
        databaseUrl: "postgresql://postgres.projectone:secret@attacker.example:6543/postgres",
      }),
    ).toThrow("same project");
    expect(() =>
      assertSupabaseDatabaseProjectMatch({
        environment: "local",
        supabaseUrl: "http://127.0.0.1:54321",
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).not.toThrow();
  });

  it("requires certificate-verified TLS for remote database connections", () => {
    expect(() =>
      getLegacyAxDatabaseConnectionConfig({
        environment: "remote",
        databaseUrl:
          "postgresql://postgres.projectone:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
      }),
    ).toThrow("DATABASE_SSL_CA is required");

    expect(
      getLegacyAxDatabaseConnectionConfig({
        environment: "remote",
        databaseUrl:
          "postgresql://postgres.projectone:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
        databaseSslCa: "-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----",
      }).options.ssl,
    ).toMatchObject({ rejectUnauthorized: true });

    expect(
      getLegacyAxDatabaseConnectionConfig({
        environment: "local",
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }).options.ssl,
    ).toBe(false);
  });

  it("exposes explicit local and remote dry-run and commit package commands", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["identity-registry:legacy-import:local"]).toBe(
      "node --import tsx scripts/import-legacy-ax-identity-graph.ts --local --ax-data-root ../data",
    );
    expect(packageJson.scripts["identity-registry:legacy-import:local:commit"]).toBe(
      "node --import tsx scripts/import-legacy-ax-identity-graph.ts --local --ax-data-root ../data --commit",
    );
    expect(packageJson.scripts["identity-registry:legacy-import:remote"]).toBe(
      "dotenv -e .env.local -- node --import tsx scripts/import-legacy-ax-identity-graph.ts --remote --ax-data-root ../data",
    );
    expect(packageJson.scripts["identity-registry:legacy-import:remote:commit"]).toBe(
      "dotenv -e .env.local -- node --import tsx scripts/import-legacy-ax-identity-graph.ts --remote --ax-data-root ../data --commit",
    );
  });
});
