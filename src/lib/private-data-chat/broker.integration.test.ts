import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { closeDb, resetDbForTests } from "@/db";
import { closePrivateDataChatAnalyticsSql } from "@/lib/private-data-chat/analytics-db";
import { executePrivateDataChatQuery } from "@/lib/private-data-chat/broker";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { FakePrivateQwenGateway } from "@/lib/private-data-chat/fake-qwen-gateway";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";

const runDatabaseTests = process.env.PRIVATE_DATA_CHAT_DATABASE_TESTS === "1";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const adminUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const adminId = "cb000001-1337-403d-8eb5-b7c44a1be131";
const proId = "cb000002-1337-403d-8eb5-b7c44a1be131";
const datasetId = "cb100001-1337-403d-8eb5-b7c44a1be131";

const identity = (input: {
  ownerId: string;
  email: string;
  workspaceRole: "admin" | "pro";
}): CurrentIdentity => ({
  ...input,
  fullName: null,
  isDatasetAdmin: input.workspaceRole === "admin",
  mode: "supabase",
});

describeDatabase("private data chat broker database integration", () => {
  const admin = postgres(adminUrl, { max: 1, prepare: false });

  beforeAll(async () => {
    await admin.unsafe(
      "alter role analytics_chat_login password 'local-chat-test'",
    );
    await admin`delete from private.analytics_chat_audit where catalog_version = 'primary-people-groups-v1'`;
    await admin`delete from public.dataset_rows where dataset_id = ${datasetId}::uuid`;
    await admin`delete from public.datasets where id = ${datasetId}::uuid`;
    await admin`
      delete from private.dataset_storage_path_claims
      where dataset_id = ${datasetId}::uuid
    `;
    await admin`
      delete from private.dataset_identity_claims
      where dataset_id = ${datasetId}::uuid
    `;
    await admin`delete from auth.users where id in (${adminId}::uuid, ${proId}::uuid)`;
    await admin`
      delete from public.signup_email_allowlist
      where email in (
        'chat-broker-admin@example.com',
        'chat-broker-pro@example.com'
      )
    `;
    await admin`
      insert into public.signup_email_allowlist (email, note)
      values
        ('chat-broker-admin@example.com', 'private data chat broker test'),
        ('chat-broker-pro@example.com', 'private data chat broker test')
      on conflict do nothing
    `;
    await admin`
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values
        (
          ${adminId}::uuid, 'authenticated', 'authenticated',
          'chat-broker-admin@example.com', '', now(),
          '{"provider":"email","providers":["email"],"workspace_role":"admin"}'::jsonb,
          '{}'::jsonb, now(), now()
        ),
        (
          ${proId}::uuid, 'authenticated', 'authenticated',
          'chat-broker-pro@example.com', '', now(),
          '{"provider":"email","providers":["email"],"workspace_role":"pro"}'::jsonb,
          '{}'::jsonb, now(), now()
        )
      on conflict (id) do nothing
    `;
    await admin`
      insert into public.datasets (
        id, owner_id, file_name, blob_url, blob_path, current_version_action,
        current_version_actor_owner_id, current_version_actor_email,
        current_version_created_at, is_primary, is_workspace_visible, status,
        row_count, size_bytes, columns, hidden_column_keys, tags
      ) values (
        ${datasetId}::uuid,
        'private-data-chat-broker-test',
        'Private Data Chat Broker Fixture',
        'https://example.invalid/private-data-chat-broker.csv',
        'datasets/csv/private-data-chat-broker.csv',
        'upload',
        'private-data-chat-broker-test',
        'chat-broker-admin@example.com',
        '2026-08-26T00:00:00Z',
        true,
        true,
        'ready',
        2,
        1024,
        '[]'::jsonb,
        '[]'::jsonb,
        '[{"id":"dataset-classification-pgac","label":"PGAC","color":"#fcab2a"}]'::jsonb
      )
    `;
    await admin`
      insert into public.dataset_rows (dataset_id, row_index, data) values
        (
          ${datasetId}::uuid, 0,
          '{"pg_peopleid1":"PG-1","people_name":"Rana","geo_country_name":"India","pg_population":"4000","christianity_frontier_group":"true"}'::jsonb
        ),
        (
          ${datasetId}::uuid, 1,
          '{"pg_peopleid1":"PG-2","people_name":"Tamang","geo_country_name":"Nepal","pg_population":"9000","christianity_frontier_group":"false"}'::jsonb
        )
    `;
  });

  afterAll(async () => {
    await closePrivateDataChatAnalyticsSql();
    await closeDb();
    resetDbForTests();
    await admin`delete from private.analytics_chat_audit where catalog_version = 'primary-people-groups-v1'`;
    await admin`delete from public.dataset_rows where dataset_id = ${datasetId}::uuid`;
    await admin`delete from public.datasets where id = ${datasetId}::uuid`;
    await admin`
      delete from private.dataset_storage_path_claims
      where dataset_id = ${datasetId}::uuid
    `;
    await admin`
      delete from private.dataset_identity_claims
      where dataset_id = ${datasetId}::uuid
    `;
    await admin`delete from auth.users where id in (${adminId}::uuid, ${proId}::uuid)`;
    await admin`
      delete from public.signup_email_allowlist
      where email in (
        'chat-broker-admin@example.com',
        'chat-broker-pro@example.com'
      )
    `;
    await admin.unsafe("alter role analytics_chat_login password null");
    await admin.end({ timeout: 5 });
  });

  it("executes the compiled query as the verified admin and writes redacted audit evidence", async () => {
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "aggregate",
      metrics: ["total_population"],
      dimensions: ["country"],
      filters: [],
      sort: [{ field: "total_population", direction: "desc" }],
      limit: 10,
    });
    const result = await executePrivateDataChatQuery({
      identity: identity({
        ownerId: adminId,
        email: "chat-broker-admin@example.com",
        workspaceRole: "admin",
      }),
      compiled,
    });

    expect(result.rows).toEqual([
      { country: "Nepal", total_population: "9000" },
      { country: "India", total_population: "4000" },
    ]);
    expect(result.provenance).toMatchObject({
      datasetId,
      rowCount: 2,
      datasetVersionCreatedAt: "2026-08-26T00:00:00.000Z",
    });

    const audit = await admin<
      {
        pseudonymous_user_id: string;
        sql_template: string;
        reason_code: string;
        model_sha256: string;
        runtime_revision: string;
      }[]
    >`
      select
        pseudonymous_user_id,
        sql_template,
        reason_code,
        model_sha256,
        runtime_revision
      from private.analytics_chat_audit
      where query_id = ${result.provenance.queryId}::uuid
    `;
    expect(audit[0]?.pseudonymous_user_id).not.toContain(adminId);
    expect(audit[0]?.sql_template).toContain("$1");
    expect(audit[0]?.reason_code).toBe("query_executed");
    expect(audit[0]?.model_sha256).toBe(
      "671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7",
    );
    expect(audit[0]?.runtime_revision).toBe(
      "c1d0e7a004015f23bc0233470b747b596f29b264",
    );
    expect(JSON.stringify(audit)).not.toContain("Nepal");
  });

  it("returns no underlying rows for a non-pilot identity", async () => {
    const compiled = compilePrivateDataChatQuery({
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id"],
      filters: [],
      sort: [],
      limit: 10,
    });
    const result = await executePrivateDataChatQuery({
      identity: identity({
        ownerId: proId,
        email: "chat-broker-pro@example.com",
        workspaceRole: "pro",
      }),
      compiled,
    });

    expect(result.rows).toEqual([]);
    expect(result.provenance.datasetId).toBeNull();
  });

  it("runs fake inference through compilation, read-only Postgres, and grounded empty-result handling", async () => {
    const adminIdentity = identity({
      ownerId: adminId,
      email: "chat-broker-admin@example.com",
      workspaceRole: "admin",
    });
    const gateway = new FakePrivateQwenGateway();
    const executeQuery: typeof executePrivateDataChatQuery = (input) =>
      executePrivateDataChatQuery(input);

    const count = await orchestratePrivateDataChatTurn({
      identity: adminIdentity,
      messages: [
        {
          role: "user",
          content: "How many people groups are in the current primary dataset?",
        },
      ],
      dependencies: { gateway, executeQuery },
    });
    expect(count.content).toContain("1 result row");
    expect(count.facts).toEqual(["people_group_count: 2"]);
    expect(count.provenance).toMatchObject({ datasetId, rowCount: 1 });

    const empty = await orchestratePrivateDataChatTurn({
      identity: adminIdentity,
      messages: [
        {
          role: "user",
          content: "List people IDs and names for people groups in Antarctica.",
        },
      ],
      dependencies: { gateway, executeQuery },
    });
    expect(empty.content).toBe(
      "No matching records were found in the approved current dataset.",
    );
    expect(empty.facts).toEqual([]);
    expect(empty.provenance).toMatchObject({ datasetId, rowCount: 0 });
  });
});
