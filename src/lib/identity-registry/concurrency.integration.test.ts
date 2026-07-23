import { createHash, randomUUID } from "node:crypto";

import { sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { publishPreparedDataset } from "@/lib/datasets";

const databaseUrl = process.env.DATABASE_URL;
const enabled = process.env.IDENTITY_REGISTRY_DB_TESTS === "1" && Boolean(databaseUrl);
type TransactionSql = postgres.TransactionSql;

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureVerifiedCutover(sql: TransactionSql) {
  const [existing] = await sql<{ present: boolean }[]>`
    select true as present
    from private.ax_identity_registry_cutovers
    where namespace = 'people-groups'
  `;
  if (existing?.present) return;

  const importId = randomUUID();
  const rawToken = `verified-cutover-${importId}`;
  const fingerprint = checksum(`cutover:people-groups:${importId}`);
  const graphChecksum = checksum("parents\nchildren\naliases\nbindings\n");
  const auditChecksum = checksum("audits\n");
  const auditArtifactChecksum = checksum("[]");
  const manifestChecksum = checksum(`manifest:${importId}`);
  const bindingTranslationChecksum = checksum(`binding-translation:${importId}`);
  const report = {
    schemaVersion: 1,
    blocking: false,
    blockingReasons: [],
    graphChecksum,
    graph: {
      bindings: 0,
      pgacIdentities: 0,
      pgicIdentities: 0,
      identities: 0,
      aliases: 0,
      allocationCounterFloor: 2055,
    },
    audit: {
      records: 0,
      checksum: auditChecksum,
      artifactChecksum: auditArtifactChecksum,
      decisions: [],
    },
    bindingTranslation: {
      algorithmVersion: "source-forming-runtime-stable-row-key-v1",
      status: "verified-pinned-source-crosswalk",
      present: true,
      rawBindingCount: 0,
      selectedActiveBindingCount: 0,
      historicalUnboundCount: 0,
      sha256: bindingTranslationChecksum,
    },
    tier2Components: [],
  };
  const [state] = await sql<{ state_fingerprint: string }[]>`
    select private.ax_identity_registry_state_fingerprint() as state_fingerprint
  `;
  const [reportEvidence] = await sql<{ report_checksum: string }[]>`
    select encode(extensions.digest(
      private.ax_identity_canonical_jsonb(${sql.json(report)}::jsonb),
      'sha256'
    ), 'hex') as report_checksum
  `;
  if (!state || !reportEvidence) {
    throw new Error("Could not prepare the verified cutover integration fixture.");
  }

  await sql`
    insert into private.ax_identity_legacy_imports (
      id, input_fingerprint, snapshot_manifest, status, actor_owner_id,
      reason, import_kind, state_fingerprint,
      graph_checksum, report_checksum, manifest_checksum, dry_run_token_hash,
      report, dry_run_completed_at
    ) values (
      ${importId}, ${fingerprint}, ${sql.json({ schemaVersion: 1 })},
      'dry-run', 'concurrency-test', 'Verified cutover integration fixture',
      'verified-identity-graph', ${state.state_fingerprint},
      ${graphChecksum}, ${reportEvidence.report_checksum}, ${manifestChecksum},
      ${checksum(rawToken)}, ${sql.json(report)}, now()
    )
  `;

  const evidencePrefix = `identity-registry-legacy-imports/${fingerprint}`;
  const artifacts = [
    "shared-uuid-ledger",
    "tier1-uuid-ledger",
    "tier2-uuid-ledger",
    "shared-rop3-ledger",
    "tier2-rop3-ledger",
    "binding-translation",
    "audit-report",
    "manifest",
    "report",
  ].map((artifactKey) => ({
    artifactKey,
    artifactKind:
      artifactKey === "manifest"
        ? "manifest"
        : artifactKey === "audit-report" || artifactKey === "report"
          ? "report"
          : "snapshot",
    storagePath: `${evidencePrefix}/${artifactKey}.json`,
    contentChecksum:
      artifactKey === "audit-report"
        ? auditArtifactChecksum
        : artifactKey === "manifest"
          ? manifestChecksum
          : artifactKey === "report"
            ? reportEvidence.report_checksum
            : artifactKey === "binding-translation"
              ? bindingTranslationChecksum
              : checksum(`${artifactKey}:${importId}`),
  }));
  for (const artifact of artifacts) {
    await sql`
      insert into storage.objects (bucket_id, name, metadata)
      values ('identity-registry-evidence', ${artifact.storagePath}, '{}'::jsonb)
    `;
    await sql`
      insert into private.ax_identity_artifacts (
        legacy_import_id, artifact_kind, artifact_key,
        storage_path, content_checksum, size_bytes
      ) values (
        ${importId}, ${artifact.artifactKind}, ${artifact.artifactKey},
        ${artifact.storagePath}, ${artifact.contentChecksum}, 1
      )
    `;
  }

  const [authorization] = await sql<{ proceed: boolean }[]>`
    select private.begin_legacy_ax_identity_graph_commit(
      ${importId}, ${fingerprint}, ${rawToken}
    ) as proceed
  `;
  if (!authorization?.proceed) {
    throw new Error("Verified cutover integration fixture was not authorized.");
  }
  const [finalized] = await sql<{ registry_revision_id: string }[]>`
    select private.finalize_legacy_ax_identity_graph_import(
      ${importId}, ${fingerprint}, ${rawToken},
      'concurrency-test', null, 'Verified cutover integration fixture'
    ) as registry_revision_id
  `;
  if (!finalized?.registry_revision_id) {
    throw new Error("Verified cutover integration fixture did not finalize.");
  }
}

describe.runIf(enabled)("AX identity allocator concurrency", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "local-identity-integration-test-key";
  });

  afterAll(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalSupabasePublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
        originalSupabasePublishableKey;
    }
  });

  it.each(["profile", "connection"] as const)(
    "serializes mapped %s changes against cutover authorization",
    async (mutation) => {
      const updater = postgres(databaseUrl!, { max: 1 });
      const committer = postgres(databaseUrl!, { max: 1 });
      const setup = postgres(databaseUrl!, { max: 1 });
      const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
      const connectionId = randomUUID();
      const profileKey = `cutover-race-${suffix}`;
      const spreadsheetId = `cutover-race-${suffix}`;
      const importId = randomUUID();
      const fingerprint = checksum(`cutover-race:${importId}`);
      const rawToken = `cutover-race-token-${suffix}`;

      try {
        const [state] = await setup.begin(async (sql) => {
          await sql`
            insert into private.api_connections (
              id, name, description, method, url, request_headers, secret_header_names,
              body_template, response_format, response_data_path, import_mode,
              dataset_name, dataset_classification, provider, provider_config,
              created_by_owner_id, updated_by_owner_id
            ) values (
              ${connectionId}, ${`Cutover race ${suffix}`}, '', 'GET',
              ${`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`},
              '[]'::jsonb, '[]'::jsonb, '', 'csv', '', 'create',
              ${`${profileKey}.csv`}, 'PGIC', 'google_sheets',
              ${sql.json({
                provider: "google_sheets",
                spreadsheetId,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
                spreadsheetTitle: "Cutover race",
                sheetId: 1,
                sheetTitle: "Engagement",
                rangeMode: "full_tab",
              })},
              'concurrency-test', 'concurrency-test'
            )
          `;
          await sql`
            insert into private.tier2_partner_profiles (
              profile_key, partner_key, display_name, api_connection_id,
              spreadsheet_id, sheet_id, sheet_title, stable_row_key_column,
              tracking_id_column, tracking_id_source, contract_version,
              contract_checksum, created_by_owner_id, updated_by_owner_id
            ) values (
              ${profileKey}, ${`race-${suffix}`}, 'Cutover race', ${connectionId},
              ${spreadsheetId}, 1, 'Engagement', 'Partner Row ID', 'ROP3', 'rop3',
              'v1', ${checksum(`contract:${suffix}`)},
              'concurrency-test', 'concurrency-test'
            )
          `;
          return sql<{ state_fingerprint: string }[]>`
            select private.ax_identity_registry_state_fingerprint() as state_fingerprint
          `;
        });
        await setup`
          insert into private.ax_identity_legacy_imports (
            id, input_fingerprint, snapshot_manifest, status, actor_owner_id,
            reason, import_kind, state_fingerprint, graph_checksum,
            report_checksum, manifest_checksum, dry_run_token_hash, report,
            dry_run_completed_at
          ) values (
            ${importId}, ${fingerprint}, '{}'::jsonb, 'dry-run', 'concurrency-test',
            'Profile update cutover race', 'verified-identity-graph',
            ${state.state_fingerprint}, ${checksum(`graph:${importId}`)},
            ${checksum(`report:${importId}`)}, ${checksum(`manifest:${importId}`)},
            ${checksum(rawToken)}, '{"blocking":false}'::jsonb, now()
          )
        `;

        const sourceUpdate = updater.begin(async (sql) => {
          if (mutation === "profile") {
            await sql`
              update private.tier2_partner_profiles
              set active = false
              where profile_key = ${profileKey}
            `;
          } else {
            await sql`
              update private.api_connections
              set archived_at = now(), archived_by_owner_id = 'concurrency-test',
                archive_reason = 'Cutover serialization test'
              where id = ${connectionId}
            `;
          }
          await sql`select pg_sleep(0.2)`;
        });
        await new Promise((resolve) => setTimeout(resolve, 40));
        await expect(
          committer`
            select private.begin_legacy_ax_identity_graph_commit(
              ${importId}, ${fingerprint}, ${rawToken}
            )
          `,
        ).rejects.toMatchObject({ code: "40001" });
        await sourceUpdate;
      } finally {
        await Promise.all([
          updater.end({ timeout: 2 }),
          committer.end({ timeout: 2 }),
          setup.end({ timeout: 2 }),
        ]);
      }
    },
    20_000,
  );

  it("serializes parallel allocations and makes same-key retries idempotent", async () => {
    const clients = Array.from({ length: 4 }, () => postgres(databaseUrl!, { max: 1 }));
    const setup = clients[0];
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const namespace = "people-groups";
    const sourceProfileKey = `parallel-${suffix}`;
    const sourceInitials = suffix;
    const datasetId = randomUUID();
    const publicationId = randomUUID();
    const producerRunId = randomUUID();
    const runId = randomUUID();
    let startingValue = 0;

    try {
      await setup.begin(async (sql) => {
        await ensureVerifiedCutover(sql);
        const [counter] = await sql<{ next_value: number }[]>`
          select next_value
          from private.ax_identity_counters
          where namespace = ${namespace}
        `;
        if (!counter) throw new Error("The AX identity allocation counter is missing.");
        startingValue = Number(counter.next_value);
        await sql`
          insert into public.datasets (
            id, owner_id, file_name, blob_url, blob_path, current_version_action,
            current_version_actor_owner_id, is_primary, is_workspace_visible,
            status, row_count, size_bytes, columns, hidden_column_keys, tags
          ) values (
            ${datasetId}, 'concurrency-test', ${`parallel-${suffix}.csv`},
            ${`https://example.test/parallel-${suffix}.csv`}, ${`tests/parallel-${suffix}.csv`},
            'api_import', 'concurrency-test', false, false, 'ready', 8, 8,
            '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
          )
        `;
        await sql`
          insert into private.pipeline_publications (
            id, producer_kind, producer_run_id, dataset_id, source_profile_key,
            output_checksum, row_count, artifact_manifest, actor_owner_id, reason
          ) values (
            ${publicationId}, 'dataset-forming', ${producerRunId}, ${datasetId},
            ${sourceProfileKey}, ${checksum(publicationId)}, 8, '{}'::jsonb,
            'concurrency-test', 'Parallel allocation regression fixture'
          )
        `;
        await sql`
          insert into private.ax_identity_runs (
            id, source_publication_id, source_profile_key, rules_version, rules_checksum,
            resource_bindings, input_fingerprint, publication_target_key,
            actor_owner_id, status, input_row_count,
            reservation_expires_at, started_at
          ) values (
            ${runId}, ${publicationId}, ${sourceProfileKey}, 'v1', ${checksum("rules")},
            '{}'::jsonb, ${checksum(runId)}, ${`identity-${sourceProfileKey}`},
            'concurrency-test', 'building', 8,
            now() + interval '1 day', now()
          )
        `;
      });

      const allocations = await Promise.all(
        Array.from({ length: 8 }, (_, index) => {
          const client = clients[index % clients.length];
          return client`
            select allocated_value, pgac_code, reused
            from private.allocate_ax_identity_value(
              ${namespace}, ${sourceProfileKey}, ${`${sourceProfileKey}:row:${index}`},
              ${runId}, 'A010', ${sourceInitials}, 'LAO', now() + interval '1 day'
            )
          `;
        }),
      );

      const values = allocations.map((rows) => Number(rows[0].allocated_value));
      expect(new Set(values).size).toBe(8);
      expect([...values].sort((left, right) => left - right)).toEqual(
        Array.from({ length: 8 }, (_, index) => startingValue + index),
      );

      const sharedKey = `${sourceProfileKey}:shared`;
      const [firstRetry, secondRetry] = await Promise.all(
        clients.slice(0, 2).map((client) => client`
          select binding_id, allocated_value, pgac_code, reused
          from private.allocate_ax_identity_value(
            ${namespace}, ${sourceProfileKey}, ${sharedKey}, ${runId},
            'A010', ${sourceInitials}, 'LAO', now() + interval '1 day'
          )
        `),
      );

      expect(firstRetry[0].binding_id).toBe(secondRetry[0].binding_id);
      expect(firstRetry[0].allocated_value).toBe(secondRetry[0].allocated_value);
      expect([firstRetry[0].reused, secondRetry[0].reused].sort()).toEqual([false, true]);
    } finally {
      await Promise.all(clients.map((client) => client.end({ timeout: 2 })));
    }
  }, 20_000);

  it("serializes expiry with publication so cleanup cannot cancel a publishing run", async () => {
    const publisher = postgres(databaseUrl!, { max: 1 });
    const cleaner = postgres(databaseUrl!, { max: 1 });
    const setup = postgres(databaseUrl!, { max: 1 });
    const sourceProfileKey = `expiry-${randomUUID().slice(0, 8)}`;
    const datasetId = randomUUID();
    const sourcePublicationId = randomUUID();
    const sourceRunId = randomUUID();
    const identityRunId = randomUUID();

    try {
      await setup.begin(async (sql) => {
        await ensureVerifiedCutover(sql);
        await sql`
          insert into public.datasets (
            id, owner_id, file_name, blob_url, blob_path, current_version_action,
            current_version_actor_owner_id, is_primary, is_workspace_visible,
            status, row_count, size_bytes, columns, hidden_column_keys, tags
          ) values (
            ${datasetId}, 'expiry-test', 'expiry.csv', 'https://example.test/expiry.csv',
            ${`tests/${datasetId}.csv`}, 'api_import', 'expiry-test', false, false,
            'ready', 0, 0, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
          )
        `;
        await sql`
          insert into private.pipeline_publications (
            id, producer_kind, producer_run_id, dataset_id, source_profile_key,
            output_checksum, row_count, artifact_manifest, actor_owner_id, reason
          ) values (
            ${sourcePublicationId}, 'dataset-forming', ${sourceRunId}, ${datasetId},
            ${sourceProfileKey}, ${checksum(sourcePublicationId)}, 0, '{}'::jsonb,
            'expiry-test', 'Expiry race regression fixture'
          )
        `;
        await sql`
          insert into private.ax_identity_runs (
            id, source_publication_id, source_profile_key, rules_version, rules_checksum,
            resource_bindings, input_fingerprint, publication_target_key,
            actor_owner_id, status,
            input_row_count, output_row_count, output_checksum,
            reservation_expires_at, started_at, completed_at
          ) values (
            ${identityRunId}, ${sourcePublicationId}, ${sourceProfileKey}, 'v1',
            ${checksum("expiry-rules")}, '{}'::jsonb, ${checksum(identityRunId)},
            ${`identity-${sourceProfileKey}`}, 'expiry-test', 'valid', 0, 0,
            ${checksum("expiry-output")},
            now() - interval '1 minute', now(), now()
          )
        `;
      });

      const publication = publisher.begin(async (sql) => {
        await sql`select pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11))`;
        await sql`
          update private.ax_identity_runs
          set status = 'publishing'
          where id = ${identityRunId}
        `;
        await sql`select pg_sleep(0.2)`;
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      const expiry = cleaner`
        select private.expire_ax_identity_run(${identityRunId}, now()) as expired
      `;

      const [, expiryRows] = await Promise.all([publication, expiry]);
      expect(expiryRows[0]?.expired).toBe(false);
      const statusRows = await setup`
        select status from private.ax_identity_runs where id = ${identityRunId}
      `;
      expect(statusRows[0]?.status).toBe("publishing");
    } finally {
      await Promise.all([
        publisher.end({ timeout: 2 }),
        cleaner.end({ timeout: 2 }),
        setup.end({ timeout: 2 }),
      ]);
    }
  }, 20_000);

  it("lets one candidate win a stable target and archives the same dataset on repeat publication", async () => {
    const setup = postgres(databaseUrl!, { max: 1 });
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const sourceProfileKey = `target-${suffix}`;
    const publicationTargetKey = `identity-${sourceProfileKey}`;
    const sourceDatasetId = randomUUID();
    const sourcePublicationId = randomUUID();
    const sourceRunId = randomUUID();
    const firstRunId = randomUUID();
    const losingRunId = randomUUID();
    const repeatRunId = randomUUID();
    const firstAttemptId = randomUUID();
    const repeatAttemptId = randomUUID();
    const emptyEvidenceChecksum = checksum("[]");

    try {
      await setup.begin(async (sql) => {
        await ensureVerifiedCutover(sql);
        await sql`
          insert into public.datasets (
            id, owner_id, file_name, blob_url, blob_path, current_version_action,
            current_version_actor_owner_id, is_primary, is_workspace_visible,
            status, row_count, size_bytes, columns, hidden_column_keys, tags
          ) values (
            ${sourceDatasetId}, 'target-test', ${`${sourceProfileKey}.csv`},
            ${`https://example.test/${sourceProfileKey}.csv`},
            ${`tests/${sourceProfileKey}.csv`}, 'api_import', 'target-test',
            false, false, 'ready', 0, 0, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
          )
        `;
        await sql`
          insert into private.pipeline_publications (
            id, producer_kind, producer_run_id, dataset_id, source_profile_key,
            output_checksum, row_count, artifact_manifest, actor_owner_id, reason
          ) values (
            ${sourcePublicationId}, 'dataset-forming', ${sourceRunId}, ${sourceDatasetId},
            ${sourceProfileKey}, ${checksum(sourcePublicationId)}, 0, '{}'::jsonb,
            'target-test', 'Stable target regression fixture'
          )
        `;
        for (const runId of [firstRunId, losingRunId]) {
          await sql`
            insert into private.ax_identity_runs (
              id, source_publication_id, source_profile_key, rules_version,
              rules_checksum, resource_bindings, input_fingerprint,
              publication_target_key, expected_current_publication_id,
              actor_owner_id, status, input_row_count, output_row_count,
              output_checksum, row_evidence_checksum, artifact_manifest,
              started_at, completed_at
            ) values (
              ${runId}, ${sourcePublicationId}, ${sourceProfileKey}, 'v1',
              ${checksum("target-rules")}, '{}'::jsonb, ${checksum(runId)},
              ${publicationTargetKey}, null, 'target-test', 'valid', 0, 0,
              ${emptyEvidenceChecksum}, ${emptyEvidenceChecksum}, '{}'::jsonb,
              now(), now()
            )
          `;
        }
        await sql`
          update private.ax_identity_runs
          set status = 'publishing', publication_attempt_id = ${firstAttemptId},
            publishing_started_at = now(),
            publication_blob_path = ${`datasets/csv/${firstRunId}.csv`}
          where id = ${firstRunId}
        `;
      });

      let firstPublicationId: string | null = null;
      const first = await publishPreparedDataset({
        actorOwnerId: "target-test",
        fileName: `${sourceProfileKey}-identity.csv`,
        blobPath: `datasets/csv/${firstRunId}.csv`,
        sizeBytes: 0,
        columns: [],
        rows: [],
        classification: "PGIC",
        isWorkspaceVisible: false,
        finalize: async ({ executor, datasetId, created }) => {
          const rows = (await executor.execute(drizzleSql<{ publication_id: string }>`
            select publication_id from private.finalize_ax_identity_publication(
              ${firstRunId}::uuid, ${datasetId}::uuid, ${firstAttemptId}::uuid,
              ${created}, 'target-test', null, 'First stable target publication'
            )
          `)) as unknown as { publication_id: string }[];
          firstPublicationId = rows[0]!.publication_id;
        },
      });
      expect(first?.created).toBe(true);
      expect(firstPublicationId).toBeTruthy();

      const losingClaim = await setup`
        update private.ax_identity_runs as run
        set status = 'publishing', publication_attempt_id = ${randomUUID()},
          publishing_started_at = now()
        where run.id = ${losingRunId} and run.status = 'valid'
          and run.expected_current_publication_id is not distinct from (
            select publication.id from private.pipeline_publications as publication
            where publication.producer_kind = 'identity'
              and publication.publication_target_key = run.publication_target_key
            order by publication.created_at desc, publication.id desc limit 1
          )
        returning run.id
      `;
      expect(losingClaim).toHaveLength(0);

      await setup`
        insert into private.ax_identity_runs (
          id, source_publication_id, base_revision_id, source_profile_key,
          rules_version, rules_checksum, resource_bindings, input_fingerprint,
          publication_target_key, expected_current_publication_id,
          actor_owner_id, status, input_row_count, output_row_count,
          output_checksum, row_evidence_checksum, artifact_manifest,
          started_at, completed_at, publication_attempt_id,
          publishing_started_at, publication_blob_path
        ) values (
          ${repeatRunId}, ${sourcePublicationId}, (
            select registry_revision_id from private.pipeline_publications where id = ${firstPublicationId}
          ), ${sourceProfileKey}, 'v1', ${checksum("target-rules")}, '{}'::jsonb,
          ${checksum(repeatRunId)}, ${publicationTargetKey}, ${firstPublicationId},
          'target-test', 'publishing', 0, 0, ${emptyEvidenceChecksum},
          ${emptyEvidenceChecksum}, '{}'::jsonb, now(), now(), ${repeatAttemptId},
          now(), ${`datasets/csv/${repeatRunId}.csv`}
        )
      `;

      let repeatPublicationId: string | null = null;
      const repeat = await publishPreparedDataset({
        targetDatasetId: first!.dataset.id,
        actorOwnerId: "target-test",
        fileName: `${sourceProfileKey}-identity.csv`,
        blobPath: `datasets/csv/${repeatRunId}.csv`,
        sizeBytes: 0,
        columns: [],
        rows: [],
        classification: "PGIC",
        isWorkspaceVisible: false,
        finalize: async ({ executor, datasetId, created }) => {
          const rows = (await executor.execute(drizzleSql<{ publication_id: string }>`
            select publication_id from private.finalize_ax_identity_publication(
              ${repeatRunId}::uuid, ${datasetId}::uuid, ${repeatAttemptId}::uuid,
              ${created}, 'target-test', null, 'Forward replacement publication'
            )
          `)) as unknown as { publication_id: string }[];
          repeatPublicationId = rows[0]!.publication_id;
        },
      });

      expect(repeat?.created).toBe(false);
      expect(repeat?.dataset.id).toBe(first?.dataset.id);
      const history = await setup`
        select
          (select count(*)::integer from public.dataset_versions
            where dataset_id = ${first!.dataset.id}) as archived_versions,
          (select count(*)::integer from private.pipeline_publications
            where producer_kind = 'identity'
              and publication_target_key = ${publicationTargetKey}) as publications,
          (select id from private.pipeline_publications
            where producer_kind = 'identity'
              and publication_target_key = ${publicationTargetKey}
            order by created_at desc, id desc limit 1) as current_publication_id
      `;
      expect(history[0].archived_versions).toBe(1);
      expect(history[0].publications).toBe(2);
      expect(history[0].current_publication_id).toBe(repeatPublicationId);
    } finally {
      await setup.end({ timeout: 2 });
    }
  }, 30_000);
});
