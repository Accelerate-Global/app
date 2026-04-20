import { mkdir, writeFile } from "node:fs/promises";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

import {
  UI_SMOKE_BASE_URL,
  UI_SMOKE_BOOTSTRAP_FILE,
  UI_SMOKE_PASSWORD_RESET,
  UI_SMOKE_TMP_DIR,
  UI_SMOKE_USERS,
  type UiSmokeBootstrap,
} from "../tests/ui/support/smoke-data";
import {
  getUiSmokeEnv,
  getUiSmokeStorageAdminKey,
} from "./lib/ui-smoke-env";
import { REGION_COUNTRY_OPTIONS } from "../src/lib/region-country-options";

const PRIMARY_DATASET_ID = "11111111-1111-4111-8111-111111111111";
const SECONDARY_DATASET_ID = "22222222-2222-4222-8222-222222222222";
const DERIVED_DATASET_ID = "99999999-9999-4999-8999-999999999999";
const GLOBAL_REGION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOUTH_ASIA_REGION_ID = "33333333-3333-4333-8333-333333333333";
const LATIN_AMERICA_REGION_ID = "44444444-4444-4444-8444-444444444444";
const JOSHUA_PROJECT_SOURCE_TYPE_ID = "55555555-5555-4555-8555-555555555555";
const ACCELERATE_SOURCE_TYPE_ID = "66666666-6666-4666-8666-666666666666";

const FIELD_DEFINITION_IDS = {
  pgPeopleId1: "77777777-7777-4777-8777-777777777771",
  peopleName: "77777777-7777-4777-8777-777777777772",
  geoCountryName: "77777777-7777-4777-8777-777777777773",
  christianityGsec: "77777777-7777-4777-8777-777777777774",
  christianityFrontierGroup: "77777777-7777-4777-8777-777777777775",
  engagementAnywhere: "77777777-7777-4777-8777-777777777776",
} as const;

type SmokeUserDefinition = {
  email: string;
  password: string;
  fullName: string;
};

type SmokeAuthUser = {
  id: string;
  email: string;
  fullName: string;
};

type SmokeWorkspaceRole = "admin" | "viewer";

type SmokeColumn = {
  key: string;
  label: string;
  sourceIndex: number;
};

type SmokeDatasetRow = Record<string, string>;

function normalizeHeaderIdentity(value: string, index = 0) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 96);

  return normalized || `column_${index + 1}`;
}

function buildBlobUrl(supabaseUrl: string, bucket: string, blobPath: string) {
  return new URL(`/storage/v1/object/${bucket}/${blobPath}`, supabaseUrl).toString();
}

async function recreateUser(input: {
  sql: postgres.Sql;
  supabaseUrl: string;
  supabasePublishableKey: string;
  user: SmokeUserDefinition;
}) {
  await input.sql`delete from auth.users where email = ${input.user.email}`;

  const authClient = createClient(
    input.supabaseUrl,
    input.supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const signUp = await authClient.auth.signUp({
    email: input.user.email,
    password: input.user.password,
    options: {
      data: {
        full_name: input.user.fullName,
      },
    },
  });

  if (signUp.error || !signUp.data.user) {
    throw signUp.error ?? new Error(`Could not create ${input.user.email}`);
  }

  const signIn = await authClient.auth.signInWithPassword({
    email: input.user.email,
    password: input.user.password,
  });

  if (signIn.error || !signIn.data.user) {
    throw signIn.error ?? new Error(`Could not sign in ${input.user.email}`);
  }

  return {
    id: signIn.data.user.id,
    email: input.user.email,
    fullName: input.user.fullName,
  } satisfies SmokeAuthUser;
}

async function setWorkspaceRole(input: {
  sql: postgres.Sql;
  userId: string;
  workspaceRole: SmokeWorkspaceRole;
}) {
  await input.sql`
    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{workspace_role}',
      to_jsonb(${input.workspaceRole}::text),
      true
    )
    where id = ${input.userId}
  `;
}

async function ensureBucket(
  supabase: SupabaseClient,
  bucketName: string,
) {
  const buckets = await supabase.storage.listBuckets();

  if (buckets.error) {
    throw buckets.error;
  }

  if (buckets.data.some((bucket: { name: string }) => bucket.name === bucketName)) {
    return;
  }

  const createdBucket = await supabase.storage.createBucket(bucketName, {
    public: false,
  });

  if (createdBucket.error) {
    throw createdBucket.error;
  }
}

async function resetSmokeData(sql: postgres.Sql) {
  const smokeEmails = Object.values(UI_SMOKE_USERS).map((user) => user.email);

  await sql`
    delete from auth.users
    where email = any(${smokeEmails})
  `;
  await sql`delete from public.dataset_rows`;
  await sql`
    delete from public.datasets
    where backing_dataset_id is not null
  `;
  await sql`
    delete from public.datasets
    where backing_dataset_id is null
  `;
  await sql`delete from public.filter_region_countries`;
  await sql`delete from public.filter_regions`;
  await sql`delete from public.field_definition_sources`;
  await sql`delete from public.field_source_types`;
  await sql`delete from public.field_definitions`;
  await sql`
    delete from public.signup_email_allowlist
    where email = any(${smokeEmails})
  `;
}

async function insertAllowlist(sql: postgres.Sql) {
  const allowlistEntries = Object.values(UI_SMOKE_USERS).map((user) => ({
    email: user.email,
    note: `UI smoke ${user.fullName}`,
  }));

  await sql`
    insert into public.signup_email_allowlist ${sql(
      allowlistEntries,
      "email",
      "note",
    )}
    on conflict (email) do update
    set note = excluded.note, updated_at = now()
  `;
}

async function insertFieldSourceTypes(sql: postgres.Sql) {
  await sql`
    insert into public.field_source_types (id, key, label, sort_order)
    values
      (${JOSHUA_PROJECT_SOURCE_TYPE_ID}, ${normalizeHeaderIdentity("Joshua Project")}, ${"Joshua Project"}, ${1}),
      (${ACCELERATE_SOURCE_TYPE_ID}, ${normalizeHeaderIdentity("Accelerate")}, ${"Accelerate"}, ${2})
    on conflict (key) do update
    set label = excluded.label, sort_order = excluded.sort_order, updated_at = now()
  `;
}

async function insertFilterRegions(sql: postgres.Sql) {
  await sql`
    insert into public.filter_regions (id, name, description, sort_order)
    values
      (${GLOBAL_REGION_ID}, ${"Global"}, ${"All countries"}, ${1}),
      (${SOUTH_ASIA_REGION_ID}, ${"South Asia"}, ${"India and Nepal"}, ${2}),
      (${LATIN_AMERICA_REGION_ID}, ${"Latin America"}, ${"Brazil and Colombia"}, ${3})
    on conflict (id) do update
    set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, updated_at = now()
  `;

  await sql`
    insert into public.filter_region_countries ${sql(
      REGION_COUNTRY_OPTIONS.map((countryName) => ({
        region_id: GLOBAL_REGION_ID,
        country_name: countryName,
      })),
      "region_id",
      "country_name",
    )}
    on conflict do nothing
  `;

  await sql`
    insert into public.filter_region_countries (region_id, country_name)
    values
      (${SOUTH_ASIA_REGION_ID}, ${"India"}),
      (${SOUTH_ASIA_REGION_ID}, ${"Nepal"}),
      (${LATIN_AMERICA_REGION_ID}, ${"Brazil"}),
      (${LATIN_AMERICA_REGION_ID}, ${"Colombia"})
    on conflict do nothing
  `;
}

async function insertDatasets(input: {
  sql: postgres.Sql;
  ownerId: string;
  actorEmail: string;
  supabaseUrl: string;
  bucket: string;
}) {
  const primaryColumns: SmokeColumn[] = [
    { key: "pg_peopleid1", label: "PG_PeopleID1", sourceIndex: 0 },
    { key: "people_name", label: "People Name", sourceIndex: 1 },
    { key: "geo_country_name", label: "Geo_Country_Name", sourceIndex: 2 },
    { key: "christianity_gsec", label: "Christianity_GSEC", sourceIndex: 3 },
    {
      key: "christianity_frontier_group",
      label: "Christianity_Frontier_Group",
      sourceIndex: 4,
    },
    { key: "pg_population", label: "PG_Population", sourceIndex: 5 },
    {
      key: "percent_evangelical_pgac",
      label: "Percent_Evangelical_PGAC",
      sourceIndex: 6,
    },
    {
      key: "engage_8_phases_of_engagement",
      label: "Engage_8_Phases_of_Engagement",
      sourceIndex: 7,
    },
    {
      key: "engage_global_engagement_anywhere",
      label: "Engage_Global_Engagement_Anywhere",
      sourceIndex: 8,
    },
  ];
  const primaryRows: SmokeDatasetRow[] = [
    {
      pg_peopleid1: "PG-1001",
      people_name: "Rana Tharu",
      geo_country_name: "India",
      christianity_gsec: "1",
      christianity_frontier_group: "true",
      pg_population: "4000",
      percent_evangelical_pgac: "2",
      engage_8_phases_of_engagement: "6",
      engage_global_engagement_anywhere: "false",
    },
    {
      pg_peopleid1: "PG-1002",
      people_name: "Tamang",
      geo_country_name: "Nepal",
      christianity_gsec: "3",
      christianity_frontier_group: "false",
      pg_population: "9000",
      percent_evangelical_pgac: "1",
      engage_8_phases_of_engagement: "5",
      engage_global_engagement_anywhere: "true",
    },
    {
      pg_peopleid1: "PG-1003",
      people_name: "Ribeirinho",
      geo_country_name: "Brazil",
      christianity_gsec: "2",
      christianity_frontier_group: "true",
      pg_population: "15000",
      percent_evangelical_pgac: "0.8",
      engage_8_phases_of_engagement: "7",
      engage_global_engagement_anywhere: "false",
    },
  ];
  const secondaryColumns: SmokeColumn[] = [
    { key: "pg_peopleid1", label: "PG_PeopleID1", sourceIndex: 0 },
    { key: "people_name", label: "People Name", sourceIndex: 1 },
    { key: "geo_country_name", label: "Geo_Country_Name", sourceIndex: 2 },
    {
      key: "engage_global_engagement_anywhere",
      label: "Engage_Global_Engagement_Anywhere",
      sourceIndex: 3,
    },
  ];
  const secondaryRows: SmokeDatasetRow[] = [
    {
      pg_peopleid1: "PG-2001",
      people_name: "Makushi",
      geo_country_name: "Colombia",
      engage_global_engagement_anywhere: "true",
    },
    {
      pg_peopleid1: "PG-2002",
      people_name: "Wayuu",
      geo_country_name: "Brazil",
      engage_global_engagement_anywhere: "false",
    },
  ];
  const primaryBlobPath = "datasets/csv/smoke-primary-dataset.csv";
  const derivedBlobPath = "datasets/csv/smoke-derived-dataset.csv";
  const secondaryBlobPath = "datasets/csv/smoke-secondary-dataset.csv";

  await input.sql`
    insert into public.datasets ${input.sql(
      [
        {
          id: PRIMARY_DATASET_ID,
          backing_dataset_id: null,
          owner_id: input.ownerId,
          file_name: "Smoke Primary Dataset",
          sort_order: 0,
          blob_url: buildBlobUrl(input.supabaseUrl, input.bucket, primaryBlobPath),
          blob_path: primaryBlobPath,
          current_version_action: "upload",
          current_version_actor_owner_id: input.ownerId,
          current_version_actor_email: input.actorEmail,
          current_version_created_at: new Date("2026-04-17T00:00:00.000Z"),
          is_primary: true,
          status: "ready",
          row_count: primaryRows.length,
          size_bytes: 1536,
          columns: primaryColumns,
          hidden_column_keys: ["christianity_frontier_group"],
          tags: [
            {
              id: "tag-smoke-primary",
              label: "Priority",
              color: "#d97706",
            },
          ],
          error: null,
        },
        {
          id: DERIVED_DATASET_ID,
          backing_dataset_id: PRIMARY_DATASET_ID,
          owner_id: input.ownerId,
          file_name: "Smoke Watchlist Dataset",
          sort_order: 1,
          blob_url: buildBlobUrl(input.supabaseUrl, input.bucket, derivedBlobPath),
          blob_path: derivedBlobPath,
          current_version_action: "upload",
          current_version_actor_owner_id: input.ownerId,
          current_version_actor_email: input.actorEmail,
          current_version_created_at: new Date("2026-04-17T00:03:00.000Z"),
          is_primary: false,
          status: "ready",
          row_count: 1,
          size_bytes: 768,
          columns: primaryColumns,
          hidden_column_keys: [],
          tags: [
            {
              id: "tag-smoke-derived",
              label: "Watchlist",
              color: "#262531",
              openPreset: {
                region: {
                  enabled: false,
                  selectedRegionIds: [],
                  selectedRegionNames: [],
                  enabledCountryNames: [],
                },
                country: {
                  enabled: true,
                  selectedCountryNames: ["India"],
                },
                watchlist: {
                  enabled: false,
                  thresholdEnabled: true,
                  threshold: 2,
                  engagementPhaseEnabled: true,
                  engagementPhaseThreshold: 6,
                  evangelicalPopulationBelieversRuleEnabled: true,
                  evangelicalPopulationBelieversRule: {
                    tiers: [
                      {
                        minPopulation: 0,
                        maxPopulation: null,
                        minBelievers: 50,
                      },
                    ],
                  },
                  frontierGroupEnabled: true,
                  frontierGroupValue: true,
                },
                uupg: {
                  enabled: false,
                },
              },
            },
          ],
          error: null,
        },
        {
          id: SECONDARY_DATASET_ID,
          backing_dataset_id: null,
          owner_id: input.ownerId,
          file_name: "Smoke Secondary Dataset",
          sort_order: 2,
          blob_url: buildBlobUrl(input.supabaseUrl, input.bucket, secondaryBlobPath),
          blob_path: secondaryBlobPath,
          current_version_action: "upload",
          current_version_actor_owner_id: input.ownerId,
          current_version_actor_email: input.actorEmail,
          current_version_created_at: new Date("2026-04-17T00:05:00.000Z"),
          is_primary: false,
          status: "ready",
          row_count: secondaryRows.length,
          size_bytes: 1024,
          columns: secondaryColumns,
          hidden_column_keys: [],
          tags: [
            {
              id: "tag-smoke-secondary",
              label: "Archive",
              color: "#2563eb",
            },
          ],
          error: null,
        },
      ],
      "id",
      "backing_dataset_id",
      "owner_id",
      "file_name",
      "sort_order",
      "blob_url",
      "blob_path",
      "current_version_action",
      "current_version_actor_owner_id",
      "current_version_actor_email",
      "current_version_created_at",
      "is_primary",
      "status",
      "row_count",
      "size_bytes",
      "columns",
      "hidden_column_keys",
      "tags",
      "error",
    )}
    on conflict (id) do update
    set
      backing_dataset_id = excluded.backing_dataset_id,
      owner_id = excluded.owner_id,
      file_name = excluded.file_name,
      sort_order = excluded.sort_order,
      blob_url = excluded.blob_url,
      blob_path = excluded.blob_path,
      current_version_action = excluded.current_version_action,
      current_version_actor_owner_id = excluded.current_version_actor_owner_id,
      current_version_actor_email = excluded.current_version_actor_email,
      current_version_created_at = excluded.current_version_created_at,
      is_primary = excluded.is_primary,
      status = excluded.status,
      row_count = excluded.row_count,
      size_bytes = excluded.size_bytes,
      columns = excluded.columns,
      hidden_column_keys = excluded.hidden_column_keys,
      tags = excluded.tags,
      error = excluded.error,
      updated_at = now()
  `;

  await input.sql`
    insert into public.dataset_rows ${input.sql(
      primaryRows.map((row, index) => ({
        dataset_id: PRIMARY_DATASET_ID,
        row_index: index,
        data: row,
      })),
      "dataset_id",
      "row_index",
      "data",
    )}
  `;
  await input.sql`
    insert into public.dataset_rows ${input.sql(
      secondaryRows.map((row, index) => ({
        dataset_id: SECONDARY_DATASET_ID,
        row_index: index,
        data: row,
      })),
      "dataset_id",
      "row_index",
      "data",
    )}
  `;
}

async function insertFieldDefinitions(sql: postgres.Sql) {
  const rows = [
    {
      id: FIELD_DEFINITION_IDS.pgPeopleId1,
      canonicalKey: normalizeHeaderIdentity("PG_PeopleID1", 0),
      label: "PG_PeopleID1",
      displayLabel: "People ID",
      definition: "Unique people group identifier used across the workspace.",
      mappingFieldId: "FIELD-1001",
      mappingDataType: "text",
      mappingIsActive: true,
      sourcePriorityKeys: [
        normalizeHeaderIdentity("Joshua Project"),
        normalizeHeaderIdentity("Accelerate"),
      ],
    },
    {
      id: FIELD_DEFINITION_IDS.peopleName,
      canonicalKey: normalizeHeaderIdentity("People Name", 1),
      label: "People Name",
      displayLabel: "",
      definition: "The common display name for the people group.",
      mappingFieldId: "FIELD-1002",
      mappingDataType: "text",
      mappingIsActive: true,
      sourcePriorityKeys: [normalizeHeaderIdentity("Joshua Project")],
    },
    {
      id: FIELD_DEFINITION_IDS.geoCountryName,
      canonicalKey: normalizeHeaderIdentity("Geo_Country_Name", 2),
      label: "Geo_Country_Name",
      displayLabel: "Country",
      definition: "Country used by the region filter cards on dataset detail pages.",
      mappingFieldId: "FIELD-1003",
      mappingDataType: "text",
      mappingIsActive: true,
      sourcePriorityKeys: [],
    },
    {
      id: FIELD_DEFINITION_IDS.christianityGsec,
      canonicalKey: normalizeHeaderIdentity("Christianity_GSEC", 3),
      label: "Christianity_GSEC",
      displayLabel: "",
      definition: "Global status estimate used by the Watchlist controls.",
      mappingFieldId: "FIELD-1004",
      mappingDataType: "number",
      mappingIsActive: true,
      sourcePriorityKeys: [],
    },
    {
      id: FIELD_DEFINITION_IDS.christianityFrontierGroup,
      canonicalKey: normalizeHeaderIdentity("Christianity_Frontier_Group", 4),
      label: "Christianity_Frontier_Group",
      displayLabel: "",
      definition: "Frontier group flag paired with Christianity_GSEC.",
      mappingFieldId: "FIELD-1005",
      mappingDataType: "boolean",
      mappingIsActive: true,
      sourcePriorityKeys: [],
    },
    {
      id: FIELD_DEFINITION_IDS.engagementAnywhere,
      canonicalKey: normalizeHeaderIdentity("Engage_Global_Engagement_Anywhere", 5),
      label: "Engage_Global_Engagement_Anywhere",
      displayLabel: "Engaged Anywhere",
      definition: "Engagement flag used by the UUPG dataset control.",
      mappingFieldId: "FIELD-1006",
      mappingDataType: "boolean",
      mappingIsActive: true,
      sourcePriorityKeys: [],
    },
  ];

  await sql`
    insert into public.field_definitions ${sql(
      rows.map((row) => ({
        id: row.id,
        canonical_key: row.canonicalKey,
        label: row.label,
        display_label: row.displayLabel,
        definition: row.definition,
        mapping_field_id: row.mappingFieldId,
        mapping_data_type: row.mappingDataType,
        mapping_is_active: row.mappingIsActive,
        source_priority_keys: row.sourcePriorityKeys,
      })),
      "id",
      "canonical_key",
      "label",
      "display_label",
      "definition",
      "mapping_field_id",
      "mapping_data_type",
      "mapping_is_active",
      "source_priority_keys",
    )}
    on conflict (canonical_key) do update
    set
      label = excluded.label,
      display_label = excluded.display_label,
      definition = excluded.definition,
      mapping_field_id = excluded.mapping_field_id,
      mapping_data_type = excluded.mapping_data_type,
      mapping_is_active = excluded.mapping_is_active,
      source_priority_keys = excluded.source_priority_keys,
      updated_at = now()
  `;
}

async function insertFieldDefinitionSources(sql: postgres.Sql) {
  await sql`
    insert into public.field_definition_sources (
      field_definition_id,
      source_type_id,
      source_field_name
    )
    values
      (${FIELD_DEFINITION_IDS.pgPeopleId1}, ${JOSHUA_PROJECT_SOURCE_TYPE_ID}, ${"people_id"}),
      (${FIELD_DEFINITION_IDS.pgPeopleId1}, ${ACCELERATE_SOURCE_TYPE_ID}, ${"accelerate_people_id"}),
      (${FIELD_DEFINITION_IDS.peopleName}, ${JOSHUA_PROJECT_SOURCE_TYPE_ID}, ${"people_name"})
    on conflict (field_definition_id, source_type_id) do update
    set source_field_name = excluded.source_field_name, updated_at = now()
  `;
}

async function main() {
  const smokeEnv = getUiSmokeEnv();
  const storageAdmin = createClient(
    smokeEnv.supabaseUrl,
    getUiSmokeStorageAdminKey(smokeEnv),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const sql = postgres(smokeEnv.databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    await mkdir(UI_SMOKE_TMP_DIR, { recursive: true });
    await ensureBucket(storageAdmin, smokeEnv.storageBucket);
    await resetSmokeData(sql);
    await insertAllowlist(sql);

    const adminUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.admin,
    });
    const viewerUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.viewer,
    });
    const recoveryUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.recovery,
    });
    const forgotPasswordUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.forgotPassword,
    });
    const resetUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.reset,
    });
    const signOutUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.signOut,
    });
    const disableUser = await recreateUser({
      sql,
      supabaseUrl: smokeEnv.supabaseUrl,
      supabasePublishableKey: smokeEnv.supabasePublishableKey,
      user: UI_SMOKE_USERS.disable,
    });
    await setWorkspaceRole({
      sql,
      userId: adminUser.id,
      workspaceRole: "admin",
    });
    await setWorkspaceRole({
      sql,
      userId: viewerUser.id,
      workspaceRole: "viewer",
    });
    await setWorkspaceRole({
      sql,
      userId: recoveryUser.id,
      workspaceRole: "viewer",
    });
    await setWorkspaceRole({
      sql,
      userId: forgotPasswordUser.id,
      workspaceRole: "viewer",
    });
    await setWorkspaceRole({
      sql,
      userId: resetUser.id,
      workspaceRole: "viewer",
    });
    await setWorkspaceRole({
      sql,
      userId: signOutUser.id,
      workspaceRole: "viewer",
    });
    await setWorkspaceRole({
      sql,
      userId: disableUser.id,
      workspaceRole: "viewer",
    });

    await insertFieldSourceTypes(sql);
    await insertFilterRegions(sql);
    await insertDatasets({
      sql,
      ownerId: adminUser.id,
      actorEmail: adminUser.email,
      supabaseUrl: smokeEnv.supabaseUrl,
      bucket: smokeEnv.storageBucket,
    });
    await insertFieldDefinitions(sql);
    await insertFieldDefinitionSources(sql);

    const payload: UiSmokeBootstrap = {
      generatedAt: new Date().toISOString(),
      baseUrl: UI_SMOKE_BASE_URL,
      aliases: {
        primaryDatasetId: PRIMARY_DATASET_ID,
        secondaryDatasetId: SECONDARY_DATASET_ID,
        derivedDatasetId: DERIVED_DATASET_ID,
        editableFieldDefinitionId: FIELD_DEFINITION_IDS.pgPeopleId1,
        editableFieldSourceTypeId: JOSHUA_PROJECT_SOURCE_TYPE_ID,
        southAsiaRegionId: SOUTH_ASIA_REGION_ID,
        latinAmericaRegionId: LATIN_AMERICA_REGION_ID,
      },
      users: {
        admin: adminUser,
        viewer: viewerUser,
        recovery: recoveryUser,
        forgotPassword: forgotPasswordUser,
        reset: resetUser,
        signOut: signOutUser,
        disable: disableUser,
      },
      authFlows: {
        allowlistedSignup: {
          email: UI_SMOKE_USERS.allowlistedSignup.email,
          password: UI_SMOKE_USERS.allowlistedSignup.password,
          fullName: UI_SMOKE_USERS.allowlistedSignup.fullName,
        },
        passwordReset: {
          nextPassword: UI_SMOKE_PASSWORD_RESET,
        },
      },
      datasets: {
        primary: {
          id: PRIMARY_DATASET_ID,
          fileName: "Smoke Primary Dataset",
        },
        derived: {
          id: DERIVED_DATASET_ID,
          fileName: "Smoke Watchlist Dataset",
        },
        secondary: {
          id: SECONDARY_DATASET_ID,
          fileName: "Smoke Secondary Dataset",
        },
      },
      fieldDefinitions: {
        editable: {
          id: FIELD_DEFINITION_IDS.pgPeopleId1,
          canonicalKey: normalizeHeaderIdentity("PG_PeopleID1", 0),
          label: "PG_PeopleID1",
        },
      },
      fieldSourceTypes: {
        editable: {
          id: JOSHUA_PROJECT_SOURCE_TYPE_ID,
          key: normalizeHeaderIdentity("Joshua Project"),
          label: "Joshua Project",
        },
      },
      filterRegions: {
        southAsia: {
          id: SOUTH_ASIA_REGION_ID,
          name: "South Asia",
        },
        latinAmerica: {
          id: LATIN_AMERICA_REGION_ID,
          name: "Latin America",
        },
      },
    };

    await writeFile(UI_SMOKE_BOOTSTRAP_FILE, JSON.stringify(payload, null, 2), "utf8");
    console.log(
      `Bootstrapped UI smoke data for ${viewerUser.email}, ${adminUser.email}, ${recoveryUser.email}, ${forgotPasswordUser.email}, ${resetUser.email}, ${signOutUser.email}, and ${disableUser.email}.`,
    );
    console.log(
      `Using publishable key length ${smokeEnv.supabasePublishableKey.length} against ${smokeEnv.supabaseUrl}.`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bootstrap] ${message}`);
  process.exitCode = 1;
});
