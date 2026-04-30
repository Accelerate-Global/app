import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  apiConnectionResources,
  apiConnectionRuns,
  apiConnectionRunLogs,
  apiConnectionRunOutputs,
  apiConnections,
  analyticsEvents,
  analyticsFailureTriage,
  datasetVersionRows,
  datasetVersions,
  datasets,
  fieldDefinitions,
  savedDatasetTables,
} from "./schema";

describe("datasets schema", () => {
  it("declares the current version metadata columns", () => {
    expect(datasets.currentVersionAction.name).toBe("current_version_action");
    expect(datasets.currentVersionActorOwnerId.name).toBe(
      "current_version_actor_owner_id",
    );
    expect(datasets.currentVersionActorEmail.name).toBe("current_version_actor_email");
    expect(datasets.currentVersionCreatedAt.name).toBe("current_version_created_at");
    expect(datasets.backingDatasetId.name).toBe("backing_dataset_id");
    expect(datasets.sourceOrganizationName.name).toBe("source_organization_name");
    expect(datasets.isPublic.name).toBe("is_public");
    expect(datasets.defaultFilters.name).toBe("default_filters");
  });

  it("creates the dataset upload versions migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260417161958_dataset_upload_versions.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      'add column if not exists current_version_action text',
    );
    expect(migration).toContain("create table if not exists public.dataset_versions");
    expect(migration).toContain(
      'create policy "dataset admin can read dataset versions"',
    );
  });

  it("creates the derived dataset backing migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260420045139_add_backing_dataset_id.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      'add column if not exists backing_dataset_id uuid',
    );
    expect(migration).toContain(
      "create trigger datasets_enforce_physical_backing_dataset",
    );
    expect(migration).toContain(
      "Derived datasets must reference a physical dataset.",
    );
  });

  it("creates the dataset public visibility migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260421201702_add_dataset_public_visibility.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "add column if not exists is_public boolean not null default true",
    );
    expect(migration).toContain(
      "using (is_public or private.is_dataset_admin())",
    );
    expect(migration).toContain(
      'create policy "authenticated users can read shared dataset rows"',
    );
  });

  it("creates the dataset default filters migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260422155055_dataset_default_filters_and_assignment.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      'add column if not exists default_filters jsonb',
    );
  });

  it("creates the dataset source organization migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260422224014_add_dataset_source_organization_name.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "add column if not exists source_organization_name text",
    );
  });

  it("creates the canonical Joshua Project region migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260422174256_canonical_joshua_project_regions_read_only.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("Asia, South");
    expect(migration).toContain("America, Latin");
    expect(migration).toContain(
      'drop policy if exists "dataset admin can insert filter regions"',
    );
    expect(migration).toContain(
      'drop policy if exists "dataset admin can delete filter region countries"',
    );
  });
});

describe("dataset versioning schema", () => {
  it("declares the version tables and foreign keys", () => {
    expect(datasetVersions.datasetId.name).toBe("dataset_id");
    expect(datasetVersions.archivedAt.name).toBe("archived_at");
    expect(datasetVersionRows.versionId.name).toBe("version_id");
    expect(datasetVersionRows.rowIndex.name).toBe("row_index");
  });
});

describe("fieldDefinitions schema", () => {
  it("declares the viewer visibility column", () => {
    expect(fieldDefinitions.hideFromViewerFieldDefinitions.name).toBe(
      "hide_from_viewer_field_definitions",
    );
  });

  it("adds the viewer visibility column with a false default in the migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260415172837_add_field_definition_viewer_visibility.sql",
    );

    await expect(readFile(migrationPath, "utf8")).resolves.toContain(
      'add column "hide_from_viewer_field_definitions" boolean not null default false',
    );
  });

  it("creates the frontier group canonical merge migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260418211633_frontier_group_canonical_merge.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("christianity_frontier_group");
    expect(migration).toContain("frontier_group");
    expect(migration).toContain("insert into public.field_definition_sources");
    expect(migration).toContain("delete from public.field_definitions");
  });
});

describe("savedDatasetTables schema", () => {
  it("declares the saved dataset table filters and row count columns", () => {
    expect(savedDatasetTables.filters.name).toBe("filters");
    expect(savedDatasetTables.savedRowCount.name).toBe("saved_row_count");
  });

  it("creates the saved dataset tables migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260417052141_add_saved_dataset_tables.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("create table if not exists public.saved_dataset_tables");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      'create policy "users can read own saved dataset tables"',
    );
  });

  it("adds the basic role saved-table and profile guard migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260427203720_add_basic_role_and_rename_viewer_to_pro.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("where raw_app_meta_data ->> 'workspace_role' = 'viewer'");
    expect(migration).toContain("'\"pro\"'::jsonb");
    expect(migration).toContain("create trigger prevent_basic_profile_updates");
    expect(migration).toContain("create or replace function private.is_workspace_basic()");
    expect(migration).toContain("and not private.is_workspace_basic()");
  });

  it("allows pending basic invite setup while preserving the profile guard", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260429032328_allow_basic_invite_account_setup.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("is_basic_initial_setup");
    expect(migration).toContain("old.invited_at is not null");
    expect(migration).toContain("new.encrypted_password is distinct from old.encrypted_password");
    expect(migration).toContain(
      "Basic users cannot update profile details.",
    );
  });

  it("promotes the first super admin and keeps admin-capable RLS aligned", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260429154231_add_super_admin_role.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("where lower(email) = 'admin@example.com'");
    expect(migration).toContain("'\"super_admin\"'::jsonb");
    expect(migration).toContain(
      "coalesce(raw_app_meta_data ->> 'workspace_role', 'pro') in ('admin', 'super_admin')",
    );
  });
});

describe("analyticsEvents schema", () => {
  it("declares the private analytics event columns", () => {
    expect(analyticsEvents.eventName.name).toBe("event_name");
    expect(analyticsEvents.route.name).toBe("route");
    expect(analyticsEvents.eventProps.name).toBe("event_props");
  });

  it("creates the private analytics events migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260418145413_add_private_analytics_events.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("create table if not exists private.analytics_events");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("create index if not exists analytics_events_created_at_idx");
  });
});

describe("analyticsFailureTriage schema", () => {
  it("declares the private analytics failure triage columns", () => {
    expect(analyticsFailureTriage.fingerprint.name).toBe("fingerprint");
    expect(analyticsFailureTriage.status.name).toBe("status");
    expect(analyticsFailureTriage.note.name).toBe("note");
    expect(analyticsFailureTriage.triagedByOwnerId.name).toBe(
      "triaged_by_owner_id",
    );
    expect(analyticsFailureTriage.triagedAt.name).toBe("triaged_at");
  });

  it("creates the private analytics failure triage migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260429161223_analytics_failure_triage.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create table if not exists private.analytics_failure_triage",
    );
    expect(migration).toContain("status in ('needs_review', 'debugging', 'expected', 'resolved')");
    expect(migration).toContain("from private.analytics_failure_resolutions");
    expect(migration).toContain("drop table if exists private.analytics_failure_resolutions");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "create index if not exists analytics_failure_triage_status_triaged_at_idx",
    );
  });
});

describe("apiConnections schema", () => {
  it("declares private API connection columns", () => {
    expect(apiConnections.secretVaultId.name).toBe("secret_vault_id");
    expect(apiConnections.requestHeaders.name).toBe("request_headers");
    expect(apiConnections.responseFormat.name).toBe("response_format");
    expect(apiConnectionRuns.connectionId.name).toBe("connection_id");
    expect(apiConnectionRuns.responsePreview.name).toBe("response_preview");
    expect(apiConnectionRuns.startedAt.name).toBe("started_at");
    expect(apiConnectionRuns.completedAt.name).toBe("completed_at");
    expect(apiConnectionRunLogs.runId.name).toBe("run_id");
    expect(apiConnectionRunLogs.message.name).toBe("message");
    expect(apiConnectionRunOutputs.rowsStoragePath.name).toBe("rows_storage_path");
    expect(apiConnectionRunOutputs.rawStoragePath.name).toBe("raw_storage_path");
    expect(apiConnectionResources.resourceUrl.name).toBe("resource_url");
    expect(apiConnectionResources.normalizedUrl.name).toBe("normalized_url");
    expect(apiConnectionResources.webText.name).toBe("web_text");
    expect(apiConnectionResources.sourceResourceIndex.name).toBe(
      "source_resource_index",
    );
  });

  it("creates the API connections migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260424120000_api_connections.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create table if not exists private.api_connections",
    );
    expect(migration).toContain("create extension if not exists supabase_vault");
    expect(migration).toContain("secret_vault_id uuid");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on private.api_connection_runs");
  });

  it("creates the API connection run outputs migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260427190408_api_connection_run_outputs.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("add column if not exists started_at");
    expect(migration).toContain(
      "check (status in ('queued', 'running', 'success', 'failed'))",
    );
    expect(migration).toContain(
      "create table if not exists private.api_connection_run_logs",
    );
    expect(migration).toContain(
      "create table if not exists private.api_connection_run_outputs",
    );
    expect(migration).toContain(
      "revoke all on private.api_connection_run_outputs",
    );
  });

  it("creates the API connection resources migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260430172440_api_connection_resources.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create table if not exists private.api_connection_resources",
    );
    expect(migration).toContain(
      "api_connection_resources_run_url_idx",
    );
    expect(migration).toContain(
      "alter table private.api_connection_resources enable row level security",
    );
    expect(migration).toContain(
      "revoke all on private.api_connection_resources",
    );
  });

  it("creates the API connection artifact bucket migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260430203342_api_connection_artifact_bucket.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("'api-connection-artifacts'");
    expect(migration).toContain("array['application/json']::text[]");
    expect(migration).toContain("134217728");
    expect(migration).toContain("on conflict (id) do update");
  });
});
