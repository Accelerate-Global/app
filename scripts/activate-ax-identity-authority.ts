import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { sql } from "drizzle-orm";

import { closeDb, getDb } from "@/db";
import {
  AX_IDENTITY_FORMATTER_CHECKSUM,
  AX_IDENTITY_RULES_CHECKSUM,
} from "@/lib/identity-registry";

const execFileAsync = promisify(execFile);

export type AuthorityActivationOptions =
  | {
      mode: "local" | "remote";
      operation: "dry-run";
      environment: string;
      actorOwnerId: string;
      actorEmail: string | null;
      reason: string;
    }
  | {
      mode: "local" | "remote";
      operation: "commit";
      attemptId: string;
      token: string;
      stateFingerprint: string;
    };

function optionValue(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function requireOption(args: readonly string[], name: string) {
  const value = optionValue(args, name)?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function parseAuthorityActivationArgs(
  args: readonly string[],
): AuthorityActivationOptions {
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local === remote) {
    throw new Error("Specify exactly one of --local or --remote.");
  }
  const mode = local ? "local" : "remote";
  if (args.includes("--commit")) {
    return {
      mode,
      operation: "commit",
      attemptId: requireOption(args, "--attempt-id"),
      token: requireOption(args, "--token"),
      stateFingerprint: requireOption(args, "--state-fingerprint"),
    };
  }
  return {
    mode,
    operation: "dry-run",
    environment: requireOption(args, "--environment"),
    actorOwnerId: requireOption(args, "--actor-owner-id"),
    actorEmail: optionValue(args, "--actor-email")?.trim() || null,
    reason: requireOption(args, "--reason"),
  };
}

function parseSupabaseEnv(output: string) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="(.*)"$/u))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2]]),
  );
}

export async function configureAuthorityDatabase(mode: "local" | "remote") {
  if (mode === "remote") {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for remote authority activation.");
    }
    return;
  }
  const { stdout } = await execFileAsync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
  });
  const values = parseSupabaseEnv(stdout);
  if (!values.DB_URL) throw new Error("The local Supabase database is not running.");
  process.env.DATABASE_URL = values.DB_URL;
}

export async function runAuthorityActivation(options: AuthorityActivationOptions) {
  await configureAuthorityDatabase(options.mode);
  try {
    if (options.operation === "dry-run") {
      const rows = (await getDb().execute(sql<{
        activation_attempt_id: string;
        activation_token: string;
        state_fingerprint: string;
        empty_graph_checksum: string;
        expires_at: Date | string;
      }>`
        select * from private.begin_ax_identity_authority_activation(
          ${options.environment}, ${AX_IDENTITY_RULES_CHECKSUM},
          ${AX_IDENTITY_FORMATTER_CHECKSUM}, ${options.actorOwnerId},
          ${options.actorEmail}, ${options.reason}
        )
      `)) as unknown as Array<{
        activation_attempt_id: string;
        activation_token: string;
        state_fingerprint: string;
        empty_graph_checksum: string;
        expires_at: Date | string;
      }>;
      const attempt = rows[0];
      if (!attempt) throw new Error("The authority dry run returned no attempt.");
      return {
        operation: "dry-run" as const,
        attemptId: attempt.activation_attempt_id,
        token: attempt.activation_token,
        stateFingerprint: attempt.state_fingerprint,
        emptyGraphChecksum: attempt.empty_graph_checksum,
        rulesChecksum: AX_IDENTITY_RULES_CHECKSUM,
        formatterChecksum: AX_IDENTITY_FORMATTER_CHECKSUM,
        expiresAt: new Date(attempt.expires_at).toISOString(),
      };
    }
    const rows = (await getDb().execute(sql<{
      authority_namespace: string;
      revision_id: string;
      revision_number: number;
    }>`
      select * from private.commit_ax_identity_authority_activation(
        ${options.attemptId}::uuid, ${options.token}, ${options.stateFingerprint},
        ${AX_IDENTITY_RULES_CHECKSUM}, ${AX_IDENTITY_FORMATTER_CHECKSUM}
      )
    `)) as unknown as Array<{
      authority_namespace: string;
      revision_id: string;
      revision_number: number;
    }>;
    const authority = rows[0];
    if (!authority) throw new Error("The authority commit returned no revision.");
    return {
      operation: "commit" as const,
      namespace: authority.authority_namespace,
      revisionId: authority.revision_id,
      revisionNumber: Number(authority.revision_number),
    };
  } finally {
    await closeDb();
  }
}

async function main() {
  const result = await runAuthorityActivation(
    parseAuthorityActivationArgs(process.argv.slice(2)),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
