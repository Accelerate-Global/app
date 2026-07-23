import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import postgres from "postgres";

import {
  assertLegacyAxIdentityGraphManifestOverlay,
  buildLegacyAxIdentityGraph,
  LEGACY_AX_GRAPH_FILE_KEYS,
  parseLegacyAxIdentityGraphManifest,
  type LegacyAxGraphFileKey,
  type LegacyAxIdentityGraphManifest,
} from "@/lib/identity-registry/importer";
import { getPostgresConnectionConfig } from "@/lib/postgres-connection";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { configureLocalReferenceResourceEnvironment } from "./bootstrap-reference-resources";

const DEFAULT_MANIFEST_PATH = fileURLToPath(
  new URL("../config/legacy-ax-identity-import-manifest.json", import.meta.url),
);
const DEFAULT_ACTOR = "system:legacy-ax-identity-graph-import";
const STORAGE_PREFIX = "identity-registry-legacy-imports";
const EVIDENCE_BUCKET = "identity-registry-evidence";
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;
const COMMIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const FLAG_ARGUMENTS = new Set(["--local", "--remote", "--commit"]);
const VALUE_ARGUMENTS = new Set([
  "--ax-data-root",
  "--manifest",
  "--fingerprint",
  "--token",
  "--reason",
  "--actor-owner-id",
  "--actor-email",
]);

export type LegacyAxIdentityGraphImportArguments = Readonly<{
  environment: "local" | "remote";
  axDataRoot: string;
  manifestPath: string;
  commit: boolean;
  fingerprint: string | null;
  token: string | null;
  reason: string | null;
  actorOwnerId: string;
  actorEmail: string | null;
}>;

function optionValue(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function parseLegacyAxIdentityGraphImportArguments(
  args: readonly string[],
): LegacyAxIdentityGraphImportArguments {
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--") continue;
    if (!FLAG_ARGUMENTS.has(argument) && !VALUE_ARGUMENTS.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (seen.has(argument)) throw new Error(`${argument} may be supplied only once.`);
    seen.add(argument);
    if (VALUE_ARGUMENTS.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
    }
  }
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local === remote) throw new Error("Choose exactly one of --local or --remote.");
  const axDataRoot = optionValue(args, "--ax-data-root");
  if (!axDataRoot) {
    throw new Error("--ax-data-root is required; latest-file discovery is not allowed.");
  }
  const commit = args.includes("--commit");
  const fingerprint = optionValue(args, "--fingerprint");
  const token = optionValue(args, "--token");
  const reason = optionValue(args, "--reason")?.trim() ?? null;
  if (commit) {
    if (!fingerprint || !CHECKSUM_PATTERN.test(fingerprint)) {
      throw new Error("--commit requires the exact prior --fingerprint value.");
    }
    if (!token || !COMMIT_TOKEN_PATTERN.test(token)) {
      throw new Error("--commit requires the exact prior --token value.");
    }
    if (!reason) throw new Error("--commit requires a non-empty --reason value.");
  } else if (fingerprint || token || reason) {
    throw new Error("Fingerprint, token, and reason are commit-only arguments.");
  }
  const actorOwnerId = optionValue(args, "--actor-owner-id")?.trim() || DEFAULT_ACTOR;
  const actorEmail = optionValue(args, "--actor-email")?.trim() || null;
  return {
    environment: local ? "local" : "remote",
    axDataRoot,
    manifestPath: optionValue(args, "--manifest") ?? DEFAULT_MANIFEST_PATH,
    commit,
    fingerprint,
    token,
    reason,
    actorOwnerId,
    actorEmail,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) =>
          Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
        )
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function checksumBody(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function createLegacyAxCommitToken(input: {
  tokenSecret: string;
  inputFingerprint: string;
  stateFingerprint: string;
  graphChecksum: string;
}) {
  if (!input.tokenSecret) throw new Error("A server-side token secret is required.");
  return createHmac("sha256", input.tokenSecret)
    .update(`${input.inputFingerprint}:${input.stateFingerprint}:${input.graphChecksum}`)
    .digest("base64url");
}

export function createLegacyAxEvidenceFingerprint(input: {
  sourceInputFingerprint: string;
  stateFingerprint: string;
  graphChecksum: string;
  reportChecksum: string;
}) {
  return checksumBody(canonicalJson(input));
}

function loopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function assertSupabaseDatabaseProjectMatch(input: {
  environment: "local" | "remote";
  supabaseUrl: string;
  databaseUrl: string;
}) {
  const api = new URL(input.supabaseUrl);
  const database = new URL(input.databaseUrl);
  if (input.environment === "local") {
    if (!loopbackHostname(api.hostname) || !loopbackHostname(database.hostname)) {
      throw new Error("Local Supabase API and database endpoints must both be loopback hosts.");
    }
    return;
  }
  const apiProjectRef = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/u)?.[1] ?? null;
  const directDatabaseRef =
    database.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/u)?.[1] ?? null;
  const isOfficialPoolerHost = /^[a-z0-9-]+\.pooler\.supabase\.com$/u.test(
    database.hostname,
  );
  const poolerDatabaseRef = isOfficialPoolerHost
    ? (database.username.match(/^postgres\.([a-z0-9]+)$/u)?.[1] ?? null)
    : null;
  const databaseProjectRef = directDatabaseRef ?? poolerDatabaseRef;
  if (!apiProjectRef || !databaseProjectRef || apiProjectRef !== databaseProjectRef) {
    throw new Error("Supabase API credentials and DATABASE_URL must target the same project.");
  }
}

export function getLegacyAxDatabaseConnectionConfig(input: {
  environment: "local" | "remote";
  databaseUrl: string;
  databaseSslCa?: string;
}) {
  return getPostgresConnectionConfig(input.databaseUrl, {
    DATABASE_SSL_CA: input.databaseSslCa,
    NODE_ENV: input.environment === "remote" ? "production" : "test",
    VERCEL_ENV: input.environment === "remote" ? "production" : undefined,
  });
}

function tokenSecret() {
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  return secret;
}

async function readPinnedFiles(input: {
  axDataRoot: string;
  manifest: LegacyAxIdentityGraphManifest;
}) {
  const root = await realpath(resolve(input.axDataRoot));
  const files = {} as Record<LegacyAxGraphFileKey, Buffer> & {
    bindingTranslation?: Buffer;
  };
  const readPinnedPath = async (relativePath: string) => {
    const path = await realpath(resolve(root, relativePath));
    const pathRelativeToRoot = relative(root, path);
    if (
      isAbsolute(pathRelativeToRoot) ||
      pathRelativeToRoot === ".." ||
      pathRelativeToRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ) {
      throw new Error("A pinned legacy AX snapshot resolves outside --ax-data-root.");
    }
    return readFile(path);
  };
  for (const key of LEGACY_AX_GRAPH_FILE_KEYS) {
    files[key] = await readPinnedPath(input.manifest.files[key].relativePath);
  }
  if (input.manifest.bindingTranslation?.relativePath) {
    files.bindingTranslation = await readPinnedPath(
      input.manifest.bindingTranslation.relativePath,
    );
  }
  return files;
}

type ArtifactEvidence = Readonly<{
  artifactKey: string;
  artifactKind: "snapshot" | "manifest" | "report";
  storagePath: string;
  body: Buffer;
  contentChecksum: string;
  contentType: string;
}>;

async function ensureImmutableArtifact(artifact: ArtifactEvidence) {
  const bucket = createSupabaseAdminClient().storage.from(EVIDENCE_BUCKET);
  const { error } = await bucket.upload(artifact.storagePath, artifact.body, {
    contentType: artifact.contentType,
    upsert: false,
  });
  if (!error) return;

  const { data, error: downloadError } = await bucket.download(artifact.storagePath);
  if (downloadError || !data) {
    throw new Error("Could not persist immutable legacy AX import evidence.");
  }
  const existing = Buffer.from(await data.arrayBuffer());
  if (checksumBody(existing) !== artifact.contentChecksum) {
    throw new Error("An immutable legacy AX artifact path already contains different content.");
  }
}

function artifactEvidence(input: {
  evidenceFingerprint: string;
  manifestBody: Buffer;
  reportBody: Buffer;
  auditBody: Buffer;
  files: Readonly<Record<LegacyAxGraphFileKey, Buffer> & { bindingTranslation?: Buffer }>;
}) {
  const prefix = `${STORAGE_PREFIX}/${input.evidenceFingerprint}`;
  const snapshots = LEGACY_AX_GRAPH_FILE_KEYS.map(
    (key): ArtifactEvidence => ({
      artifactKey: key.replace(/[A-Z]/gu, (value) => `-${value.toLowerCase()}`),
      artifactKind: "snapshot",
      storagePath: `${prefix}/${key}.csv`,
      body: input.files[key],
      contentChecksum: checksumBody(input.files[key]),
      contentType: "text/csv",
    }),
  );
  return [
    ...snapshots,
    ...(input.files.bindingTranslation
      ? [
          {
            artifactKey: "binding-translation",
            artifactKind: "snapshot" as const,
            storagePath: `${prefix}/binding-translation.csv`,
            body: input.files.bindingTranslation,
            contentChecksum: checksumBody(input.files.bindingTranslation),
            contentType: "text/csv",
          },
        ]
      : []),
    {
      artifactKey: "audit-report",
      artifactKind: "report",
      storagePath: `${prefix}/audit-report.json`,
      body: input.auditBody,
      contentChecksum: checksumBody(input.auditBody),
      contentType: "application/json",
    },
    {
      artifactKey: "manifest",
      artifactKind: "manifest",
      storagePath: `${prefix}/manifest.json`,
      body: input.manifestBody,
      contentChecksum: checksumBody(input.manifestBody),
      contentType: "application/json",
    },
    {
      artifactKey: "report",
      artifactKind: "report",
      storagePath: `${prefix}/report.json`,
      body: input.reportBody,
      contentChecksum: checksumBody(input.reportBody),
      contentType: "application/json",
    },
  ] satisfies ArtifactEvidence[];
}

async function loadDatabaseValidation(
  sql: ReturnType<typeof postgres>,
  manifest: LegacyAxIdentityGraphManifest,
) {
  const profileKeys = [
    ...new Set(
      Object.values(manifest.tier2Components)
        .map((mapping) => mapping.profileKey)
        .filter((profileKey): profileKey is string => Boolean(profileKey)),
    ),
  ].sort();
  const profiles =
    profileKeys.length === 0
      ? []
      : await sql<LegacyAxTier2ProfileSnapshot[]>`
          select profile.profile_key, profile.partner_key,
            profile.api_connection_id, profile.spreadsheet_id, profile.sheet_id,
            profile.contract_version, profile.contract_checksum, profile.active,
            connection.provider as connection_provider,
            connection.provider_config as connection_provider_config,
            connection.archived_at::text as connection_archived_at
          from private.tier2_partner_profiles as profile
          left join private.api_connections as connection
            on connection.id = profile.api_connection_id
          where profile.profile_key = any(${profileKeys}::text[])
          order by profile.profile_key
        `;
  const tier2ProfileValidation = inspectLegacyAxTier2ProfileMappings({ manifest, profiles });
  const [registry] = await sql<{
    state_fingerprint: string;
    identity_count: number;
    code_count: number;
    binding_count: number;
    revision_count: number;
    cutover_count: number;
  }[]>`
    select private.ax_identity_registry_state_fingerprint() as state_fingerprint,
      (select count(*)::integer from private.ax_identities) as identity_count,
      (select count(*)::integer from private.ax_identity_codes) as code_count,
      (select count(*)::integer from private.ax_identity_source_bindings) as binding_count,
      (select count(*)::integer from private.ax_registry_revisions) as revision_count,
      (select count(*)::integer from private.ax_identity_registry_cutovers) as cutover_count
  `;
  if (!registry) throw new Error("Could not inspect the AX identity registry state.");
  return {
    profileKeys,
    tier2ProfileValidation,
    registry,
    registryEmpty:
      registry.identity_count === 0 &&
      registry.code_count === 0 &&
      registry.binding_count === 0 &&
      registry.revision_count === 0 &&
      registry.cutover_count === 0,
  };
}

export type LegacyAxTier2ProfileSnapshot = Readonly<{
  profile_key: string;
  partner_key: string;
  api_connection_id: string;
  spreadsheet_id: string;
  sheet_id: number;
  contract_version: string;
  contract_checksum: string;
  active: boolean;
  connection_provider: string | null;
  connection_provider_config: unknown;
  connection_archived_at: string | null;
}>;

export function inspectLegacyAxTier2ProfileMappings(input: {
  manifest: LegacyAxIdentityGraphManifest;
  profiles: readonly LegacyAxTier2ProfileSnapshot[];
}) {
  const profilesByKey = new Map(input.profiles.map((profile) => [profile.profile_key, profile]));
  const mappedComponents = Object.entries(input.manifest.tier2Components).filter(
    (entry): entry is [string, { expectedRowCount: number; profileKey: string }] =>
      Boolean(entry[1].profileKey),
  );
  const profileUseCounts = new Map<string, number>();
  for (const [, mapping] of mappedComponents) {
    profileUseCounts.set(mapping.profileKey, (profileUseCounts.get(mapping.profileKey) ?? 0) + 1);
  }
  const reasons: string[] = [];
  const mappings = mappedComponents.map(([component, mapping]) => {
    const profile = profilesByKey.get(mapping.profileKey) ?? null;
    const connectionConfig =
      profile?.connection_provider_config &&
      typeof profile.connection_provider_config === "object" &&
      !Array.isArray(profile.connection_provider_config)
        ? (profile.connection_provider_config as Record<string, unknown>)
        : null;
    const connectionSpreadsheetId =
      typeof connectionConfig?.spreadsheetId === "string"
        ? connectionConfig.spreadsheetId
        : null;
    const connectionSheetId =
      typeof connectionConfig?.sheetId === "number" ||
      typeof connectionConfig?.sheetId === "string"
        ? Number(connectionConfig.sheetId)
        : null;
    const expectedSpreadsheetId = component.startsWith("spreadsheet:")
      ? component.slice("spreadsheet:".length)
      : null;
    const unique = profileUseCounts.get(mapping.profileKey) === 1;
    const active = profile?.active === true;
    const sourceIdentityMatches =
      expectedSpreadsheetId === null || profile?.spreadsheet_id === expectedSpreadsheetId;
    const connectionActive =
      profile?.connection_provider === "google_sheets" &&
      profile.connection_archived_at === null;
    const connectionSourceIdentityMatches =
      Boolean(profile?.api_connection_id) &&
      connectionSpreadsheetId === profile?.spreadsheet_id &&
      connectionSheetId === Number(profile?.sheet_id);
    if (!profile || !active) {
      reasons.push(
        `Tier 2 profile ${mapping.profileKey} is missing or inactive in the target database.`,
      );
    }
    if (!unique) {
      reasons.push(`Tier 2 profile ${mapping.profileKey} is mapped from more than one component.`);
    }
    if (profile && !sourceIdentityMatches) {
      reasons.push(
        `Tier 2 component ${component} does not match profile ${mapping.profileKey}'s spreadsheet ID.`,
      );
    }
    if (profile && !connectionActive) {
      reasons.push(
        `Tier 2 profile ${mapping.profileKey} does not have an active Google Sheets connection.`,
      );
    }
    if (profile && !connectionSourceIdentityMatches) {
      reasons.push(
        `Tier 2 profile ${mapping.profileKey}'s connection does not match its exact Sheet identity.`,
      );
    }
    return {
      component,
      profileKey: mapping.profileKey,
      expectedSpreadsheetId,
      unique,
      active,
      sourceIdentityMatches,
      connectionActive,
      connectionSourceIdentityMatches,
      profile: profile
        ? {
            partnerKey: profile.partner_key,
            apiConnectionId: profile.api_connection_id,
            spreadsheetId: profile.spreadsheet_id,
            sheetId: Number(profile.sheet_id),
            contractVersion: profile.contract_version,
            contractChecksum: profile.contract_checksum,
            connectionProvider: profile.connection_provider,
            connectionSpreadsheetId,
            connectionSheetId,
          }
        : null,
    };
  });
  return { reasons: [...new Set(reasons)].sort(), mappings };
}

function effectiveReport(input: {
  report: ReturnType<typeof buildLegacyAxIdentityGraph>["report"];
  tier2ProfileValidation: ReturnType<typeof inspectLegacyAxTier2ProfileMappings>;
  registryEmpty: boolean;
}) {
  const databaseReasons = [
    ...input.tier2ProfileValidation.reasons,
    ...(input.registryEmpty
      ? []
      : ["The target AX identity registry is not empty and cannot accept initial cutover."]),
  ];
  const blockingReasons = [...new Set([...input.report.blockingReasons, ...databaseReasons])].sort();
  const databaseMappings = new Map(
    input.tier2ProfileValidation.mappings.map((mapping) => [mapping.component, mapping]),
  );
  return {
    ...input.report,
    blocking: blockingReasons.length > 0,
    blockingReasons,
    tier2Components: input.report.tier2Components.map((component) => {
      const validation = databaseMappings.get(component.component);
      return {
        ...component,
        databaseProfile: validation?.profile ?? null,
        expectedSpreadsheetId: validation?.expectedSpreadsheetId ?? null,
        profileActive: validation?.active ?? false,
        profileMappingUnique: validation?.unique ?? false,
        sourceIdentityMatches: validation?.sourceIdentityMatches ?? false,
        connectionActive: validation?.connectionActive ?? false,
        connectionSourceIdentityMatches:
          validation?.connectionSourceIdentityMatches ?? false,
      };
    }),
    databaseValidation: {
      registryEmpty: input.registryEmpty,
      validatedTier2ProfileCount: input.tier2ProfileValidation.mappings.filter(
        (mapping) =>
          mapping.active &&
          mapping.unique &&
          mapping.sourceIdentityMatches &&
          mapping.connectionActive &&
          mapping.connectionSourceIdentityMatches &&
          mapping.profile,
      ).length,
    },
  };
}

async function persistDryRun(input: {
  sql: ReturnType<typeof postgres>;
  manifest: LegacyAxIdentityGraphManifest;
  files: Readonly<Record<LegacyAxGraphFileKey, Buffer>>;
  plan: ReturnType<typeof buildLegacyAxIdentityGraph>;
  report: ReturnType<typeof effectiveReport>;
  evidenceFingerprint: string;
  reportChecksum: string;
  stateFingerprint: string;
  token: string;
  identity: Readonly<{ ownerId: string; email: string | null }>;
}) {
  const canonicalManifestBody = Buffer.from(canonicalJson(input.manifest));
  const reportBody = Buffer.from(canonicalJson(input.report));
  const auditBody = Buffer.from(canonicalJson(input.plan.audits));
  const artifacts = artifactEvidence({
    evidenceFingerprint: input.evidenceFingerprint,
    manifestBody: canonicalManifestBody,
    reportBody,
    auditBody,
    files: input.files,
  });
  for (const artifact of artifacts) await ensureImmutableArtifact(artifact);

  const storedObjects = await input.sql<{ name: string }[]>`
    select name
    from storage.objects
    where bucket_id = ${EVIDENCE_BUCKET}
      and name = any(${artifacts.map((artifact) => artifact.storagePath)}::text[])
    order by name
  `;
  const storedObjectNames = new Set(storedObjects.map((row) => row.name));
  if (artifacts.some((artifact) => !storedObjectNames.has(artifact.storagePath))) {
    throw new Error("Legacy AX evidence storage does not belong to the target database project.");
  }

  const reportChecksum = checksumBody(reportBody);
  if (reportChecksum !== input.reportChecksum) {
    throw new Error("The legacy AX report checksum changed before persistence.");
  }
  if (checksumBody(auditBody) !== input.report.audit.artifactChecksum) {
    throw new Error("The legacy AX audit artifact checksum changed before persistence.");
  }
  const manifestChecksum = checksumBody(canonicalManifestBody);
  const tokenHash = checksumBody(input.token);
  const snapshotManifest = {
    schemaVersion: 1,
    manifestChecksum,
    files: Object.fromEntries(
      LEGACY_AX_GRAPH_FILE_KEYS.map((key) => [
        key,
        {
          ...input.manifest.files[key],
          storagePath: artifacts.find((artifact) => artifact.artifactKey === key.replace(/[A-Z]/gu, (value) => `-${value.toLowerCase()}`))!
            .storagePath,
        },
      ]),
    ),
    bindingTranslation: input.manifest.bindingTranslation?.relativePath
      ? {
          ...input.manifest.bindingTranslation,
          storagePath: artifacts.find(
            (artifact) => artifact.artifactKey === "binding-translation",
          )!.storagePath,
        }
      : null,
  };
  const inserted = await input.sql<{ id: string }[]>`
    insert into private.ax_identity_legacy_imports (
      input_fingerprint, snapshot_manifest, status, finding_count,
      actor_owner_id, actor_email, reason, import_kind,
      state_fingerprint, graph_checksum, report_checksum, manifest_checksum,
      dry_run_token_hash, report, dry_run_completed_at
    ) values (
      ${input.evidenceFingerprint}, ${input.sql.json(snapshotManifest)},
      ${input.report.blocking ? "blocked" : "dry-run"},
      ${input.report.blockingReasons.length},
      ${input.identity.ownerId}, ${input.identity.email},
      'Verified legacy AX identity graph dry-run', 'verified-identity-graph',
      ${input.stateFingerprint}, ${input.plan.graphChecksum},
      ${reportChecksum}, ${manifestChecksum}, ${tokenHash},
      ${input.sql.json(input.report)}, now()
    )
    on conflict (input_fingerprint) do nothing
    returning id
  `;
  const [stored] = inserted.length
    ? await input.sql<{
        id: string;
        import_kind: string;
        status: string;
        state_fingerprint: string;
        graph_checksum: string;
        report_checksum: string;
        manifest_checksum: string;
        dry_run_token_hash: string;
      }[]>`
        select id, import_kind, status, state_fingerprint, graph_checksum,
          report_checksum, manifest_checksum, dry_run_token_hash
        from private.ax_identity_legacy_imports
        where id = ${inserted[0]!.id}::uuid
      `
    : await input.sql<{
        id: string;
        import_kind: string;
        status: string;
        state_fingerprint: string;
        graph_checksum: string;
        report_checksum: string;
        manifest_checksum: string;
        dry_run_token_hash: string;
      }[]>`
        select id, import_kind, status, state_fingerprint, graph_checksum,
          report_checksum, manifest_checksum, dry_run_token_hash
        from private.ax_identity_legacy_imports
        where input_fingerprint = ${input.evidenceFingerprint}
        limit 1
      `;
  if (
    !stored ||
    stored.import_kind !== "verified-identity-graph" ||
    stored.state_fingerprint !== input.stateFingerprint ||
    stored.graph_checksum !== input.plan.graphChecksum ||
    stored.report_checksum !== reportChecksum ||
    stored.manifest_checksum !== manifestChecksum ||
    stored.dry_run_token_hash !== tokenHash
  ) {
    throw new Error("Existing legacy AX dry-run evidence does not match the exact input.");
  }

  for (const artifact of artifacts) {
    await input.sql`
      insert into private.ax_identity_artifacts (
        legacy_import_id, artifact_kind, artifact_key,
        storage_path, content_checksum, size_bytes
      ) values (
        ${stored.id}::uuid, ${artifact.artifactKind}, ${artifact.artifactKey},
        ${artifact.storagePath}, ${artifact.contentChecksum}, ${artifact.body.byteLength}
      )
      on conflict do nothing
    `;
  }
  const evidence = await input.sql<{
    artifact_key: string;
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
  }[]>`
    select artifact_key, storage_path, content_checksum, size_bytes
    from private.ax_identity_artifacts
    where legacy_import_id = ${stored.id}::uuid
    order by artifact_key
  `;
  if (
    evidence.length !== artifacts.length ||
    evidence.some((row) => {
      const artifact = artifacts.find((entry) => entry.artifactKey === row.artifact_key);
      return (
        !artifact ||
        artifact.storagePath !== row.storage_path ||
        artifact.contentChecksum !== row.content_checksum ||
        artifact.body.byteLength !== row.size_bytes
      );
    })
  ) {
    throw new Error("Stored legacy AX artifact evidence is incomplete or inconsistent.");
  }
  return { importId: stored.id, status: stored.status, reportChecksum, manifestChecksum, artifacts };
}

async function stageAndCommitGraph(input: {
  sql: ReturnType<typeof postgres>;
  importId: string;
  fingerprint: string;
  token: string;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
  plan: ReturnType<typeof buildLegacyAxIdentityGraph>;
}) {
  if (input.plan.blocking || input.plan.bindings.some((binding) => !binding.sourceProfileKey)) {
    throw new Error("The legacy AX graph remains blocked and cannot be committed.");
  }
  return input.sql.begin(async (tx) => {
    const [begin] = await tx<{ proceed: boolean }[]>`
      select private.begin_legacy_ax_identity_graph_commit(
        ${input.importId}::uuid, ${input.fingerprint}, ${input.token}
      ) as proceed
    `;
    if (!begin?.proceed) {
      const [existing] = await tx<{ registry_revision_id: string }[]>`
        select registry_revision_id
        from private.ax_identity_registry_cutovers
        where legacy_import_id = ${input.importId}::uuid
      `;
      if (!existing) throw new Error("Committed legacy AX cutover evidence is incomplete.");
      return { registryRevisionId: existing.registry_revision_id, idempotent: true } as const;
    }

    await tx`
      create temporary table legacy_ax_import_parents (
        identity_id uuid not null default gen_random_uuid(),
        canonical_code text primary key,
        allocated_value integer,
        rop3_component text
      ) on commit drop;
      create temporary table legacy_ax_import_children (
        identity_id uuid not null default gen_random_uuid(),
        canonical_code text primary key,
        parent_canonical_code text not null,
        normalized_iso3 text not null
      ) on commit drop;
      create temporary table legacy_ax_import_aliases (
        code text primary key,
        identity_canonical_code text not null,
        identity_kind text not null
      ) on commit drop;
      create temporary table legacy_ax_import_bindings (
        source_profile_key text not null,
        stable_row_key text not null,
        identity_canonical_code text not null,
        source_pgac_code text not null,
        source_pgic_code text not null,
        tier2_component text,
        primary key (source_profile_key, stable_row_key)
      ) on commit drop
    `;

    const batchSize = 1_000;
    const parentRows = input.plan.parents.map((parent) => ({
      canonical_code: parent.canonicalCode,
      allocated_value: parent.allocatedValue,
      rop3_component: parent.rop3Component,
    }));
    for (let offset = 0; offset < parentRows.length; offset += batchSize) {
      await tx`insert into legacy_ax_import_parents ${tx(
        parentRows.slice(offset, offset + batchSize),
        "canonical_code",
        "allocated_value",
        "rop3_component",
      )}`;
    }
    const childRows = input.plan.children.map((child) => ({
      canonical_code: child.canonicalCode,
      parent_canonical_code: child.parentCanonicalCode,
      normalized_iso3: child.normalizedIso3,
    }));
    for (let offset = 0; offset < childRows.length; offset += batchSize) {
      await tx`insert into legacy_ax_import_children ${tx(
        childRows.slice(offset, offset + batchSize),
        "canonical_code",
        "parent_canonical_code",
        "normalized_iso3",
      )}`;
    }
    const aliasRows = input.plan.aliases.map((alias) => ({
      code: alias.code,
      identity_canonical_code: alias.identityCanonicalCode,
      identity_kind: alias.identityKind,
    }));
    if (aliasRows.length > 0) {
      await tx`insert into legacy_ax_import_aliases ${tx(
        aliasRows,
        "code",
        "identity_canonical_code",
        "identity_kind",
      )}`;
    }
    const bindingRows = input.plan.bindings.map((binding) => ({
      source_profile_key: binding.sourceProfileKey!,
      stable_row_key: binding.stableRowKey,
      identity_canonical_code: binding.identityCanonicalCode,
      source_pgac_code: binding.sourcePgacCode,
      source_pgic_code: binding.sourcePgicCode,
      tier2_component: binding.tier2Component,
    }));
    for (let offset = 0; offset < bindingRows.length; offset += batchSize) {
      await tx`insert into legacy_ax_import_bindings ${tx(
        bindingRows.slice(offset, offset + batchSize),
        "source_profile_key",
        "stable_row_key",
        "identity_canonical_code",
        "source_pgac_code",
        "source_pgic_code",
        "tier2_component",
      )}`;
    }

    await tx`
      insert into private.ax_identities (
        id, namespace, identity_kind, allocated_value, rop3_component,
        lifecycle_state, created_by_import_id, activated_at
      )
      select identity_id, 'people-groups', 'pgac', allocated_value, rop3_component,
        'active', ${input.importId}::uuid, now()
      from legacy_ax_import_parents;

      insert into private.ax_identities (
        id, namespace, identity_kind, parent_identity_id, normalized_iso3,
        lifecycle_state, created_by_import_id, activated_at
      )
      select child.identity_id, 'people-groups', 'pgic', parent.identity_id,
        child.normalized_iso3, 'active', ${input.importId}::uuid, now()
      from legacy_ax_import_children as child
      join legacy_ax_import_parents as parent
        on parent.canonical_code = child.parent_canonical_code;

      insert into private.ax_identity_codes (
        identity_id, code, code_kind, lifecycle_state, created_by_import_id
      )
      select identity_id, canonical_code, 'canonical', 'active', ${input.importId}::uuid
      from legacy_ax_import_parents
      union all
      select identity_id, canonical_code, 'canonical', 'active', ${input.importId}::uuid
      from legacy_ax_import_children;

      with targets as (
        select canonical_code, identity_id, 'pgac'::text as identity_kind
        from legacy_ax_import_parents
        union all
        select canonical_code, identity_id, 'pgic'::text as identity_kind
        from legacy_ax_import_children
      )
      insert into private.ax_identity_codes (
        identity_id, code, code_kind, lifecycle_state, created_by_import_id
      )
      select target.identity_id, alias.code, 'alias', 'active', ${input.importId}::uuid
      from legacy_ax_import_aliases as alias
      join targets as target
        on target.canonical_code = alias.identity_canonical_code
       and target.identity_kind = alias.identity_kind;

      insert into private.ax_identity_source_bindings (
        source_profile_key, stable_row_key, identity_id, legacy_import_id,
        binding_state, source_pgac_code, source_pgic_code, legacy_component, activated_at
      )
      select binding.source_profile_key, binding.stable_row_key, child.identity_id,
        ${input.importId}::uuid, 'active', binding.source_pgac_code,
        binding.source_pgic_code, binding.tier2_component, now()
      from legacy_ax_import_bindings as binding
      join legacy_ax_import_children as child
        on child.canonical_code = binding.identity_canonical_code
    `;

    const auditRows = input.plan.audits.map((audit) => ({
      legacy_import_id: input.importId,
      audit_kind: audit.auditKind,
      source_file_key: audit.sourceFileKey,
      stable_row_key_hash: audit.stableRowKeyHash,
      details: tx.json(audit.details),
    }));
    for (let offset = 0; offset < auditRows.length; offset += batchSize) {
      await tx`insert into private.ax_identity_legacy_import_audits ${tx(
        auditRows.slice(offset, offset + batchSize),
        "legacy_import_id",
        "audit_kind",
        "source_file_key",
        "stable_row_key_hash",
        "details",
      )}`;
    }

    const [finalized] = await tx<{ registry_revision_id: string }[]>`
      select private.finalize_legacy_ax_identity_graph_import(
        ${input.importId}::uuid, ${input.fingerprint}, ${input.token},
        ${input.actorOwnerId}, ${input.actorEmail}, ${input.reason}
      ) as registry_revision_id
    `;
    if (!finalized) throw new Error("Legacy AX graph cutover did not return a revision.");
    return { registryRevisionId: finalized.registry_revision_id, idempotent: false } as const;
  });
}

export async function runLegacyAxIdentityGraphImport(
  args: LegacyAxIdentityGraphImportArguments,
) {
  const [canonicalManifestBody, overlayManifestBody] = await Promise.all([
    readFile(DEFAULT_MANIFEST_PATH),
    readFile(resolve(args.manifestPath)),
  ]);
  const canonicalManifest = parseLegacyAxIdentityGraphManifest(
    JSON.parse(canonicalManifestBody.toString("utf8")) as unknown,
  );
  const manifest = parseLegacyAxIdentityGraphManifest(
    JSON.parse(overlayManifestBody.toString("utf8")) as unknown,
  );
  assertLegacyAxIdentityGraphManifestOverlay({ canonical: canonicalManifest, overlay: manifest });
  const files = await readPinnedFiles({ axDataRoot: args.axDataRoot, manifest });
  const plan = buildLegacyAxIdentityGraph({ manifest, files });

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  assertSupabaseDatabaseProjectMatch({
    environment: args.environment,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
  });
  const connection = getLegacyAxDatabaseConnectionConfig({
    environment: args.environment,
    databaseUrl: process.env.DATABASE_URL,
    databaseSslCa: process.env.DATABASE_SSL_CA,
  });
  const sql = postgres(connection.databaseUrl, {
    ...connection.options,
    max: 1,
    prepare: false,
  });
  try {
    if (args.commit) {
      const [existing] = await sql<{
        registry_revision_id: string;
        legacy_import_id: string;
        input_fingerprint: string;
        graph_checksum: string;
        report_checksum: string;
        dry_run_token_hash: string;
        import_kind: string;
        status: string;
      }[]>`
        select cutover.registry_revision_id, cutover.legacy_import_id,
          cutover.input_fingerprint, cutover.graph_checksum, cutover.report_checksum,
          legacy.dry_run_token_hash, legacy.import_kind, legacy.status
        from private.ax_identity_registry_cutovers as cutover
        join private.ax_identity_legacy_imports as legacy
          on legacy.id = cutover.legacy_import_id
        where cutover.namespace = 'people-groups'
      `;
      if (existing) {
        if (
          existing.import_kind !== "verified-identity-graph" ||
          existing.status !== "committed" ||
          existing.input_fingerprint !== args.fingerprint ||
          existing.graph_checksum !== plan.graphChecksum ||
          existing.dry_run_token_hash !== checksumBody(args.token!)
        ) {
          throw new Error("A different or inconsistent verified legacy AX cutover already exists.");
        }
        return {
          status: "committed",
          idempotent: true,
          importId: existing.legacy_import_id,
          fingerprint: existing.input_fingerprint,
          graphChecksum: plan.graphChecksum,
          reportChecksum: existing.report_checksum,
          registryRevisionId: existing.registry_revision_id,
        } as const;
      }
    }
    const validation = await loadDatabaseValidation(sql, manifest);
    const report = effectiveReport({
      report: plan.report,
      tier2ProfileValidation: validation.tier2ProfileValidation,
      registryEmpty: validation.registryEmpty,
    });
    const reportChecksum = checksumBody(canonicalJson(report));
    const evidenceFingerprint = createLegacyAxEvidenceFingerprint({
      sourceInputFingerprint: plan.inputFingerprint,
      stateFingerprint: validation.registry.state_fingerprint,
      graphChecksum: plan.graphChecksum,
      reportChecksum,
    });
    const token = createLegacyAxCommitToken({
      tokenSecret: tokenSecret(),
      inputFingerprint: evidenceFingerprint,
      stateFingerprint: validation.registry.state_fingerprint,
      graphChecksum: plan.graphChecksum,
    });
    const dryRun = await persistDryRun({
      sql,
      manifest,
      files,
      plan,
      report,
      evidenceFingerprint,
      reportChecksum,
      stateFingerprint: validation.registry.state_fingerprint,
      token,
      identity: { ownerId: args.actorOwnerId, email: args.actorEmail },
    });

    if (!args.commit) {
      const auditArtifact = dryRun.artifacts.find(
        (artifact) => artifact.artifactKey === "audit-report",
      )!;
      return {
        status: report.blocking ? "blocked" : "dry-run",
        importId: dryRun.importId,
        fingerprint: evidenceFingerprint,
        commitToken: report.blocking ? null : token,
        tokenSemantics:
          "Bound to this fingerprint, graph, target database state, and environment; reusable only for an unchanged retry before commit.",
        stateFingerprint: validation.registry.state_fingerprint,
        graphChecksum: plan.graphChecksum,
        reportChecksum: dryRun.reportChecksum,
        auditArtifact: {
          storagePath: auditArtifact.storagePath,
          contentChecksum: auditArtifact.contentChecksum,
          records: plan.audits.length,
        },
        report,
      } as const;
    }

    if (args.fingerprint !== evidenceFingerprint) {
      throw new Error("The commit fingerprint does not match this exact dry-run evidence.");
    }
    if (report.blocking) throw new Error("The verified dry-run remains blocked.");
    if (checksumBody(args.token!) !== checksumBody(token)) {
      throw new Error("The commit token does not match this fingerprint and target state.");
    }
    const committed = await stageAndCommitGraph({
      sql,
      importId: dryRun.importId,
      fingerprint: evidenceFingerprint,
      token: args.token!,
      actorOwnerId: args.actorOwnerId,
      actorEmail: args.actorEmail,
      reason: args.reason!,
      plan,
    });
    return {
      status: "committed",
      idempotent: committed.idempotent,
      importId: dryRun.importId,
      fingerprint: evidenceFingerprint,
      graphChecksum: plan.graphChecksum,
      reportChecksum: dryRun.reportChecksum,
      registryRevisionId: committed.registryRevisionId,
    } as const;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const args = parseLegacyAxIdentityGraphImportArguments(process.argv.slice(2));
  if (args.environment === "local") await configureLocalReferenceResourceEnvironment();
  const result = await runLegacyAxIdentityGraphImport(args);
  console.log(JSON.stringify(result, null, 2));
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    const databaseCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "database-error")
        : null;
    console.error(
      databaseCode
        ? `Legacy AX identity graph import failed (${databaseCode}).`
        : error instanceof Error
          ? error.message
          : "Legacy AX identity graph import failed.",
    );
    process.exit(1);
  });
}
