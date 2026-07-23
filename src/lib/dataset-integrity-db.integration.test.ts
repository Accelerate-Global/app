import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATASET_INTEGRITY_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const clients: Array<ReturnType<typeof postgres>> = [];

function createClient() {
  if (!databaseUrl) {
    throw new Error("DATASET_INTEGRITY_DATABASE_URL is required.");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
  clients.push(client);
  return client;
}

async function insertDataset(input: {
  client: ReturnType<typeof postgres>;
  id: string;
  blobPath: string;
}) {
  await input.client`
    insert into public.datasets (
      id, owner_id, file_name, blob_url, blob_path, current_version_action,
      current_version_actor_owner_id, is_primary, is_workspace_visible,
      status, row_count, size_bytes, columns, hidden_column_keys, tags
    ) values (
      ${input.id}::uuid,
      'dataset-integrity-integration',
      'integration.csv',
      ${`https://example.invalid/${input.id}.csv`},
      ${input.blobPath},
      'upload',
      'dataset-integrity-integration',
      false,
      true,
      'ready',
      0,
      1,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    )
  `;
}

async function forceCleanup(input: {
  client: ReturnType<typeof postgres>;
  datasetIds: string[];
  blobPaths: string[];
}) {
  await input.client`set session_replication_role = replica`;
  try {
    await input.client`
      delete from private.pipeline_publications
      where dataset_id = any(${input.datasetIds}::uuid[])
    `;
    await input.client`
      delete from public.datasets
      where id = any(${input.datasetIds}::uuid[])
    `;
    await input.client`
      delete from private.dataset_storage_path_claims
      where storage_path = any(${input.blobPaths}::text[])
    `;
  } finally {
    await input.client`set session_replication_role = origin`;
  }
}

describeDatabase("dataset integrity database integration", () => {
  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
  });

  it("serializes concurrent claims so exactly one dataset owns a path", async () => {
    const first = createClient();
    const second = createClient();
    const inspection = createClient();
    const firstDatasetId = randomUUID();
    const secondDatasetId = randomUUID();
    const blobPath = `datasets/csv/integrity-concurrency-${randomUUID()}.csv`;

    try {
      await first`begin`;
      await second`begin`;
      await insertDataset({
        client: first,
        id: firstDatasetId,
        blobPath,
      });

      const competingInsert = insertDataset({
        client: second,
        id: secondDatasetId,
        blobPath,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await first`commit`;

      await expect(competingInsert).rejects.toMatchObject({
        code: "23505",
      });
      await second`rollback`;

      const [ownership] = await inspection`
        select count(*)::integer as count
        from public.datasets
        where blob_path = ${blobPath}
      `;
      expect(ownership?.count).toBe(1);
    } finally {
      await first`rollback`.catch(() => undefined);
      await second`rollback`.catch(() => undefined);
      await forceCleanup({
        client: inspection,
        datasetIds: [firstDatasetId, secondDatasetId],
        blobPaths: [blobPath],
      });
    }
  });

  it("expires publication authorization when its transaction commits", async () => {
    const client = createClient();
    const datasetId = randomUUID();
    const publicationId = randomUUID();
    const producerRunId = randomUUID();
    const blobPath = `datasets/csv/integrity-capability-${randomUUID()}.csv`;

    try {
      await insertDataset({
        client,
        id: datasetId,
        blobPath,
      });
      await client`
        insert into private.pipeline_publications (
          id, producer_kind, producer_run_id, dataset_id, output_checksum,
          row_count, artifact_manifest, actor_owner_id, reason,
          publication_target_key
        ) values (
          ${publicationId}::uuid,
          'tier1-merge',
          ${producerRunId}::uuid,
          ${datasetId}::uuid,
          ${"a".repeat(64)},
          0,
          '{}'::jsonb,
          'dataset-integrity-integration',
          'Transaction expiry fixture',
          ${`tier1-integrity-${datasetId.replaceAll("-", "")}`}
        )
      `;

      await client`begin`;
      await client`select private.authorize_pipeline_dataset_mutation()`;
      await client`
        update public.datasets
        set status = 'processing'
        where id = ${datasetId}::uuid
      `;
      await client`commit`;

      await client`begin`;
      await expect(
        client`
          update public.datasets
          set status = 'failed'
          where id = ${datasetId}::uuid
        `,
      ).rejects.toMatchObject({
        code: "42501",
      });
      await client`rollback`;
    } finally {
      await client`rollback`.catch(() => undefined);
      await forceCleanup({
        client,
        datasetIds: [datasetId],
        blobPaths: [blobPath],
      });
    }
  });
});
