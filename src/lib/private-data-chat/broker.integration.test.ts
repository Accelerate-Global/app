import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { closeDb, resetDbForTests } from "@/db";
import { closePrivateDataChatAnalyticsSql } from "@/lib/private-data-chat/analytics-db";
import { executePrivateDataChatQuery } from "@/lib/private-data-chat/broker";
import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { compilePrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { FakePrivateQwenGateway } from "@/lib/private-data-chat/fake-qwen-gateway";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";
import type { PrivateDataChatQuery } from "@/lib/private-data-chat/schemas";
import {
  matchesIncidentUupg,
  PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE,
} from "@/lib/private-data-chat/fixtures/sudan-incident";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";

const runDatabaseTests = process.env.PRIVATE_DATA_CHAT_DATABASE_TESTS === "1";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const adminUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const adminId = "cb000001-1337-403d-8eb5-b7c44a1be131";
const proId = "cb000002-1337-403d-8eb5-b7c44a1be131";
const datasetId = "cb100001-1337-403d-8eb5-b7c44a1be131";
const ropFormingRunId = "cb200001-1337-403d-8eb5-b7c44a1be131";
const ropPublicationId = "cb300001-1337-403d-8eb5-b7c44a1be131";
const ropFixtureVersionId = "cb400001-1337-403d-8eb5-b7c44a1be131";
const ropFixtureSetId = "cb500001-1337-403d-8eb5-b7c44a1be131";

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
  let previousPrimaryDatasetIds: string[] = [];
  let previousRopActiveVersionId: string | null = null;

  beforeAll(async () => {
    await admin.unsafe(
      "alter role analytics_chat_login password 'local-chat-test'",
    );
    await admin`delete from private.analytics_chat_audit where catalog_version = ${PRIVATE_DATA_CHAT_CATALOG_VERSION}`;
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
    previousPrimaryDatasetIds = (
      await admin<{ id: string }[]>`
        select id from public.datasets where is_primary order by id
      `
    ).map((row) => row.id);
    await admin`update public.datasets set is_primary = false where is_primary`;
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

    const [ropResource] = await admin<
      { id: string; active_version_id: string | null }[]
    >`
      select id, active_version_id
      from private.reference_resources
      where resource_key = 'rop-codes'
    `;
    expect(ropResource).toBeDefined();
    previousRopActiveVersionId = ropResource!.active_version_id;

    await admin`
      insert into private.reference_resource_versions (
        id, resource_id, version_number, lifecycle_state, schema_version,
        source_retrieved_at, source_metadata, normalized_resource,
        artifact_manifest, validation_summary, diff_summary, entry_count,
        created_by_owner_id
      )
      select
        ${ropFixtureVersionId}::uuid,
        ${ropResource!.id}::uuid,
        coalesce(max(version_number), 0) + 1,
        'building',
        1,
        now(),
        '{"fixture":"private-data-chat-broker"}'::jsonb,
        '{"fixture":"private-data-chat-broker"}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        7,
        'private-data-chat-test'
      from private.reference_resource_versions
      where resource_id = ${ropResource!.id}::uuid
    `;
    await admin`
      insert into private.rop_reference_terms (
        version_id, level, code, parent_code, name, status
      ) values
        (${ropFixtureVersionId}::uuid, 'rop1', 'R1', null, 'Fixture ROP1', 'Active'),
        (${ropFixtureVersionId}::uuid, 'rop2', 'R2', 'R1', 'Fixture ROP2', 'Active'),
        (${ropFixtureVersionId}::uuid, 'rop25', '250001', 'R2', 'Fixture ROP25', 'Active'),
        (${ropFixtureVersionId}::uuid, 'rop3', '300001', '250001', 'Fixture ROP3', 'Active')
    `;
    await admin`
      insert into private.rop_reference_people (
        version_id, stable_key, row_type, rop1_code, rop2_code,
        rop25_code, rop3_code, status, join_issue, search_text
      ) values
        (
          ${ropFixtureVersionId}::uuid,
          'fixture:matched',
          'rop3-person',
          'R1',
          'R2',
          '250001',
          '300001',
          'Active',
          null,
          '300001 fixture matched'
        ),
        (
          ${ropFixtureVersionId}::uuid,
          'fixture:join-issue',
          'rop3-person',
          'R1',
          'R2',
          null,
          '300002',
          'Active',
          'missing-rop25',
          '300002 fixture join issue'
        )
    `;
    await admin`
      insert into private.rop_reference_geographies (
        version_id, geo_id, rop3_code, rog, geo_name, status, search_text
      ) values (
        ${ropFixtureVersionId}::uuid,
        1,
        '300001',
        'FIX',
        'Fixtureland',
        'Active',
        '300001 Fixtureland FIX'
      )
    `;
    await admin`
      update private.reference_resource_versions
      set
        lifecycle_state = 'valid',
        content_checksum = ${"7".repeat(64)},
        finalized_at = now()
      where id = ${ropFixtureVersionId}::uuid
    `;
    await admin`
      insert into private.reference_resource_sets (
        id, content_checksum, created_by_owner_id, reason
      ) values (
        ${ropFixtureSetId}::uuid,
        ${"8".repeat(64)},
        'private-data-chat-test',
        'Self-contained broker ROP fixture'
      )
    `;
    await admin`
      insert into private.reference_resource_set_members (
        set_id, resource_id, version_id
      ) values (
        ${ropFixtureSetId}::uuid,
        ${ropResource!.id}::uuid,
        ${ropFixtureVersionId}::uuid
      )
    `;
    await admin`select set_config('app.reference_resource_activation', 'allowed', false)`;
    await admin`
      update private.reference_resources
      set active_version_id = ${ropFixtureVersionId}::uuid
      where id = ${ropResource!.id}::uuid
    `;
    await admin`select set_config('app.reference_resource_activation', '', false)`;
  });

  afterAll(async () => {
    await closePrivateDataChatAnalyticsSql();
    await closeDb();
    resetDbForTests();
    await admin.unsafe("set session_replication_role = replica");
    await admin`delete from private.pipeline_publications where id = ${ropPublicationId}::uuid`;
    await admin`delete from private.dataset_forming_runs where id = ${ropFormingRunId}::uuid`;
    await admin`
      delete from private.rop_reference_people
      where stable_key = 'test-inactive:999998'
    `;
    await admin`
      update private.reference_resources
      set active_version_id = ${previousRopActiveVersionId}::uuid
      where resource_key = 'rop-codes'
    `;
    await admin`
      delete from private.reference_resource_set_members
      where set_id = ${ropFixtureSetId}::uuid
    `;
    await admin`
      delete from private.reference_resource_sets
      where id = ${ropFixtureSetId}::uuid
    `;
    await admin`
      delete from private.rop_reference_geographies
      where version_id = ${ropFixtureVersionId}::uuid
    `;
    await admin`
      delete from private.rop_reference_people
      where version_id = ${ropFixtureVersionId}::uuid
    `;
    await admin`
      delete from private.rop_reference_terms
      where version_id = ${ropFixtureVersionId}::uuid
    `;
    await admin`
      delete from private.reference_resource_versions
      where id = ${ropFixtureVersionId}::uuid
    `;
    await admin.unsafe("set session_replication_role = origin");
    await admin`delete from private.analytics_chat_audit where catalog_version = ${PRIVATE_DATA_CHAT_CATALOG_VERSION}`;
    await admin`delete from public.dataset_rows where dataset_id = ${datasetId}::uuid`;
    await admin`delete from public.datasets where id = ${datasetId}::uuid`;
    for (const previousId of previousPrimaryDatasetIds) {
      await admin`
        update public.datasets set is_primary = true where id = ${previousId}::uuid
      `;
    }
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
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
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
    const resolveValues = async (query: PrivateDataChatQuery) => ({
      status: "resolved" as const,
      query,
      valueBindings: [],
    });

    const count = await orchestratePrivateDataChatTurn({
      identity: adminIdentity,
      messages: [
        {
          role: "user",
          content: "How many people groups are in the current primary dataset?",
        },
      ],
      dependencies: { gateway, executeQuery, resolveValues },
    });
    expect(count.content).toContain("1 result row");
    expect(count.facts).toEqual(["People-group count: 2 people groups"]);
    expect(count.provenance).toMatchObject({ datasetId, rowCount: 1 });

    const empty = await orchestratePrivateDataChatTurn({
      identity: adminIdentity,
      messages: [
        {
          role: "user",
          content: "List people IDs and names for people groups in Antarctica.",
        },
      ],
      dependencies: { gateway, executeQuery, resolveValues },
    });
    expect(empty.content).toBe(
      "No matching records were found in the approved current dataset.",
    );
    expect(empty.facts).toEqual([]);
    expect(empty.provenance).toMatchObject({ datasetId, rowCount: 0 });
  });

  it("uses the immutable dataset-bound ROP version with null preservation and nonmultiplying geography", async () => {
    const [binding] = await admin<
      {
        set_id: string;
        version_id: string;
        rop3_code: string;
        geography: string;
        rop1_code: string;
        rop2_code: string;
        rop25_code: string;
        join_issue_code: string;
      }[]
    >`
      select
        member.set_id,
        member.version_id,
        people.rop3_code,
        coalesce(geography.geo_name, geography.iso_alpha3, geography.rog)
          as geography,
        people.rop1_code,
        people.rop2_code,
        people.rop25_code,
        (
          select issue.rop3_code
          from private.rop_reference_people as issue
          where issue.version_id = member.version_id
            and issue.status = 'Active'
            and issue.join_issue is not null
            and issue.rop3_code is not null
          order by issue.rop3_code
          limit 1
        ) as join_issue_code
      from private.reference_resource_set_members as member
      join private.reference_resources as resource
        on resource.id = member.resource_id
        and resource.resource_key = 'rop-codes'
      join private.rop_reference_people as people
        on people.version_id = member.version_id
        and people.rop3_code is not null
        and people.status = 'Active'
        and people.join_issue is null
      join private.rop_reference_geographies as geography
        on geography.version_id = member.version_id
        and geography.rop3_code = people.rop3_code
      order by member.created_at desc, people.rop3_code, geography.geo_id
      limit 1
    `;
    expect(binding).toBeDefined();

    await admin`
      update public.dataset_rows
      set data = data || jsonb_build_object(
        'pg_rop3',
        case row_index
          when 0 then ${binding!.rop3_code}
          else ''
        end
      )
      where dataset_id = ${datasetId}::uuid
    `;
    await admin`
      insert into public.dataset_rows (dataset_id, row_index, data) values
        (
          ${datasetId}::uuid, 2,
          '{"pg_peopleid1":"PG-3","people_name":"Malformed ROP","geo_country_name":"Sudan","pg_rop3":"abc"}'::jsonb
        ),
        (
          ${datasetId}::uuid, 3,
          '{"pg_peopleid1":"PG-4","people_name":"Unmatched ROP","geo_country_name":"Sudan","pg_rop3":"999999"}'::jsonb
        ),
        (
          ${datasetId}::uuid, 4,
          '{"pg_peopleid1":"PG-5","people_name":"Inactive ROP","geo_country_name":"Sudan","pg_rop3":"999998"}'::jsonb
        ),
        (
          ${datasetId}::uuid, 5,
          jsonb_build_object(
            'pg_peopleid1', 'PG-6',
            'people_name', 'ROP join issue',
            'geo_country_name', 'Sudan',
            'pg_rop3', ${binding!.join_issue_code}::text
          )
        )
    `;
    await admin`update public.datasets set row_count = 6 where id = ${datasetId}::uuid`;

    try {
      await admin.unsafe("set session_replication_role = replica");
      await admin`
        insert into private.rop_reference_people (
          version_id, stable_key, row_type, rop1_code, rop2_code,
          rop25_code, rop3_code, status, search_text
        ) values (
          ${binding!.version_id}::uuid,
          'test-inactive:999998',
          'rop3-person',
          ${binding!.rop1_code},
          ${binding!.rop2_code},
          ${binding!.rop25_code},
          '999998',
          'Inactive',
          '999998 test inactive'
        )
      `;
      await admin`
        insert into private.dataset_forming_runs (
          id, connection_id, source_run_id, resource_set_id,
          actor_owner_id, status, source_rows_checksum, source_raw_checksum,
          field_contract_version, field_contract_checksum,
          transformation_version, transformation_checksum,
          input_row_count, output_row_count, source_profile_key, engine_key,
          artifact_schema_version, input_fingerprint, publication_target_key
        ) values (
          ${ropFormingRunId}::uuid,
          gen_random_uuid(),
          gen_random_uuid(),
          ${binding!.set_id}::uuid,
          'private-data-chat-test',
          'valid',
          ${"1".repeat(64)},
          ${"2".repeat(64)},
          1,
          ${"3".repeat(64)},
          'test-v1',
          ${"4".repeat(64)},
          2,
          2,
          'test-profile',
          'test-engine',
          1,
          ${"5".repeat(64)},
          'private-data-chat-test'
        )
      `;
      await admin`
        insert into private.pipeline_publications (
          id, producer_kind, producer_run_id, dataset_id,
          output_checksum, row_count, actor_owner_id, reason, created_at
        ) values (
          ${ropPublicationId}::uuid,
          'dataset-forming',
          ${ropFormingRunId}::uuid,
          ${datasetId}::uuid,
          ${"6".repeat(64)},
          2,
          'private-data-chat-test',
          'Bound ROP integration fixture',
          now() + interval '1 minute'
        )
      `;
    } finally {
      await admin.unsafe("set session_replication_role = origin");
    }

    const adminIdentity = identity({
      ownerId: adminId,
      email: "chat-broker-admin@example.com",
      workspaceRole: "admin",
    });
    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id", "rop3_code", "rop2_name", "rop_match_status"],
      filters: [],
      sort: [{ field: "people_id", direction: "asc" }],
      limit: 10,
    });
    const bound = await executePrivateDataChatQuery({
      identity: adminIdentity,
      compiled,
    });
    expect(bound.rows).toEqual([
      expect.objectContaining({
        people_id: "PG-1",
        rop3_code: binding!.rop3_code,
        rop_match_status: "matched",
      }),
      expect.objectContaining({
        people_id: "PG-2",
        rop3_code: null,
        rop_match_status: "blank",
      }),
      expect.objectContaining({
        people_id: "PG-3",
        rop3_code: null,
        rop_match_status: "malformed",
      }),
      expect.objectContaining({
        people_id: "PG-4",
        rop3_code: "999999",
        rop_match_status: "unmatched",
      }),
      expect.objectContaining({
        people_id: "PG-5",
        rop3_code: "999998",
        rop_match_status: "inactive",
      }),
      expect.objectContaining({
        people_id: "PG-6",
        rop3_code: binding!.join_issue_code,
        rop_match_status: "join_issue",
      }),
    ]);
    const geography = await executePrivateDataChatQuery({
      identity: adminIdentity,
      compiled: compilePrivateDataChatQuery({
        catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
        dataset: "primary_people_groups",
        mode: "records",
        fields: ["people_id", "rop3_code"],
        filters: [
          {
            field: "rop_geography",
            operator: "eq",
            value: binding!.geography,
          },
        ],
        sort: [{ field: "people_id", direction: "asc" }],
        limit: 10,
      }),
    });
    expect(geography.rows).toContainEqual({
      people_id: "PG-1",
      rop3_code: binding!.rop3_code,
    });
    expect(new Set(geography.rows.map((row) => row.people_id)).size).toBe(
      geography.rows.length,
    );

    const [activeRop] = await admin<{ active_version_id: string }[]>`
      select active_version_id
      from private.reference_resources
      where resource_key = 'rop-codes'
    `;
    await admin`select set_config('app.reference_resource_activation', 'allowed', false)`;
    await admin`
      update private.reference_resources
      set active_version_id = null
      where resource_key = 'rop-codes'
    `;
    await admin`select set_config('app.reference_resource_activation', '', false)`;
    const afterPointerDrift = await executePrivateDataChatQuery({
      identity: adminIdentity,
      compiled,
    });
    expect(afterPointerDrift.rows).toEqual(bound.rows);
    await admin`select set_config('app.reference_resource_activation', 'allowed', false)`;
    await admin`
      update private.reference_resources
      set active_version_id = ${activeRop!.active_version_id}::uuid
      where resource_key = 'rop-codes'
    `;
    await admin`select set_config('app.reference_resource_activation', '', false)`;

    await admin.unsafe("set session_replication_role = replica");
    try {
      await admin`delete from private.pipeline_publications where id = ${ropPublicationId}::uuid`;
      await admin`delete from private.dataset_forming_runs where id = ${ropFormingRunId}::uuid`;
      await admin`
        delete from private.rop_reference_people
        where version_id = ${binding!.version_id}::uuid
          and stable_key = 'test-inactive:999998'
      `;
    } finally {
      await admin.unsafe("set session_replication_role = origin");
    }
    await admin`
      delete from public.dataset_rows
      where dataset_id = ${datasetId}::uuid and row_index >= 2
    `;
    await admin`
      update public.dataset_rows set data = data - 'pg_rop3'
      where dataset_id = ${datasetId}::uuid and row_index < 2
    `;
    await admin`update public.datasets set row_count = 2 where id = ${datasetId}::uuid`;
  });

  it("proves table/SQL identity and never calls 100 returned rows the 104-match total", async () => {
    await admin.unsafe("set session_replication_role = replica");
    await admin`delete from private.pipeline_publications where id = ${ropPublicationId}::uuid`;
    await admin`delete from private.dataset_forming_runs where id = ${ropFormingRunId}::uuid`;
    await admin.unsafe("set session_replication_role = origin");
    const fixtureRows = PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE.rows.map(
      (row) => ({
        peopleId: row.peopleId,
        globallyEngaged:
          row.globallyEngaged === null ? "" : String(row.globallyEngaged),
        frontierGroup:
          row.frontierGroup === null ? "" : String(row.frontierGroup),
      }),
    );
    await admin`delete from public.dataset_rows where dataset_id = ${datasetId}::uuid`;
    await admin`
      insert into public.dataset_rows (dataset_id, row_index, data)
      select
        ${datasetId}::uuid,
        source.ordinality::integer - 1,
        jsonb_build_object(
          'pg_peopleid1', source.value ->> 'peopleId',
          'people_name', source.value ->> 'peopleId',
          'geo_country_name', 'Sudan',
          'engage_global_engagement_anywhere', source.value ->> 'globallyEngaged',
          'christianity_frontier_group', source.value ->> 'frontierGroup'
        )
      from jsonb_array_elements(${admin.json(fixtureRows)}::jsonb)
        with ordinality as source(value, ordinality)
    `;
    await admin`
      update public.datasets set row_count = 180 where id = ${datasetId}::uuid
    `;

    const compiled = compilePrivateDataChatQuery({
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      namedFilterRegistryVersion:
        PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
      dataset: "primary_people_groups",
      mode: "records",
      fields: ["people_id"],
      filters: [{ field: "country", operator: "eq", value: "Sudan" }],
      namedFilters: [
        {
          key: "uupg",
          version: 1,
          options: {
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: true,
          },
        },
      ],
      sort: [{ field: "people_id", direction: "asc" }],
      limit: 100,
    });
    const result = await executePrivateDataChatQuery({
      identity: identity({
        ownerId: adminId,
        email: "chat-broker-admin@example.com",
        workspaceRole: "admin",
      }),
      compiled,
    });
    const expectedIds = PRIVATE_DATA_CHAT_SUDAN_INCIDENT_FIXTURE.rows
      .filter(matchesIncidentUupg)
      .map((row) => row.peopleId)
      .sort();
    expect(result).toMatchObject({
      returnedCount: 100,
      matchingCount: 104,
      hasMore: true,
      appliedNamedFilters: ["uupg"],
    });
    expect(result.rows.map((row) => row.people_id)).toEqual(
      expectedIds.slice(0, 100),
    );
    expect(result.rows.map((row) => row.people_id)).not.toContain(
      expectedIds[103],
    );
  });
});
