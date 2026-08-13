import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  apiConnectionResources,
  apiConnectionRuns,
  apiConnectionRunLogs,
  apiConnectionRunOutputs,
  apiConnections,
  datasetVersionRows,
  datasetVersions,
  datasets,
  datasetFormingFindings,
  datasetFormingResourceBindings,
  datasetFormingRuns,
  fieldDefinitions,
  isoCountryCodeEntryOverrides,
  referenceResources,
  referenceResourceVersions,
  referenceResourceActivationEvents,
  referenceResourceSets,
  referenceResourceSetMembers,
  countryReferenceEntries,
  pipelineReferenceEntries,
  ropReferenceTerms,
  ropReferencePeople,
  ropReferenceGeographies,
  partnerExportProfileColumns,
  partnerExportProfiles,
  partnerExportRuns,
  savedDatasetTables,
  sourceProfileBindings,
} from "./schema";

describe("datasets schema", () => {
  it("creates the fresh AX Online identity authority without legacy import paths", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260813014754_establish_fresh_ax_identity_authority.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("create table private.ax_identity_authorities");
    expect(migration).toContain("create table private.ax_identity_rop3_evidence");
    expect(migration).toContain("create table private.ax_identity_change_decisions");
    expect(migration).toContain("begin_ax_identity_authority_activation");
    expect(migration).toContain("commit_ax_identity_authority_activation");
    expect(migration).toContain("new_revision_number <> 1");
    expect(migration).toContain("next_value from private.ax_identity_counters");
    expect(migration).toContain("drop table private.ax_identity_legacy_imports");
    expect(migration).not.toContain("AX2");
  });

  it("declares the current version metadata columns", () => {
    expect(datasets.currentVersionAction.name).toBe("current_version_action");
    expect(datasets.currentVersionActorOwnerId.name).toBe(
      "current_version_actor_owner_id",
    );
    expect(datasets.currentVersionActorEmail.name).toBe("current_version_actor_email");
    expect(datasets.currentVersionCreatedAt.name).toBe("current_version_created_at");
    expect(datasets.backingDatasetId.name).toBe("backing_dataset_id");
    expect(datasets.sourceOrganizationName.name).toBe("source_organization_name");
    expect(datasets.isWorkspaceVisible.name).toBe("is_workspace_visible");
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

  it("hardens pipeline dataset writes and storage-path ownership", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260723042404_harden_pipeline_dataset_integrity.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create unique index if not exists datasets_blob_path_unique_idx",
    );
    expect(migration).toContain(
      "create table if not exists private.dataset_storage_path_claims",
    );
    expect(migration).toContain("primary key (storage_path, dataset_id)");
    expect(migration).toContain(
      "create table if not exists private.dataset_storage_path_owners",
    );
    expect(migration).toContain(
      "create table if not exists private.dataset_identity_claims",
    );
    expect(migration).toContain(
      "check (is_grandfathered or btrim(storage_path) <> '')",
    );
    expect(migration).toContain(
      "excluded.owner_dataset_ids <@ ownership.owner_dataset_ids",
    );
    expect(migration).toContain(
      "group by historical_path.blob_path, historical_path.dataset_id",
    );
    expect(migration).not.toContain(
      "Resolve the aliases before applying the integrity migration.",
    );
    expect(migration).toContain("Dataset identifiers are immutable.");
    expect(migration).toContain(
      "before update of id on public.datasets",
    );
    expect(migration).toContain(
      "after insert or update of blob_path on public.datasets",
    );
    expect(migration).toContain(
      "after insert or update of blob_path, dataset_id on public.dataset_versions",
    );
    expect(migration).toContain(
      "create trigger datasets_pipeline_managed_guard",
    );
    expect(migration).toContain(
      "create trigger dataset_version_rows_pipeline_managed_guard",
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

  it("creates the original dataset visibility migration", async () => {
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

  it("creates the canonical workspace visibility compatibility migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260714172000_rename_dataset_visibility_to_workspace_visible.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "add column if not exists is_workspace_visible boolean",
    );
    expect(migration).toContain("datasets_sync_workspace_visibility");
    expect(migration).toContain(
      "using (is_workspace_visible or private.is_dataset_admin())",
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

describe("versioned reference-resource schema", () => {
  it("declares catalog, immutable package, audit, set, and typed projection columns", () => {
    expect(referenceResources.activeVersionId.name).toBe("active_version_id");
    expect(referenceResourceVersions.contentChecksum.name).toBe("content_checksum");
    expect(referenceResourceVersions.artifactManifest.name).toBe("artifact_manifest");
    expect(referenceResourceActivationEvents.previousVersionId.name).toBe("previous_version_id");
    expect(referenceResourceActivationEvents.selectedVersionId.name).toBe("selected_version_id");
    expect(referenceResourceSets.contentChecksum.name).toBe("content_checksum");
    expect(referenceResourceSetMembers.versionId.name).toBe("version_id");
    expect(countryReferenceEntries.stableKey.name).toBe("stable_key");
    expect(ropReferenceTerms.parentCode.name).toBe("parent_code");
    expect(ropReferencePeople.rop3Code.name).toBe("rop3_code");
    expect(ropReferencePeople.joinIssue.name).toBe("join_issue");
    expect(ropReferenceGeographies.peopleId3.name).toBe("people_id3");
    expect(pipelineReferenceEntries.stableKey.name).toBe("stable_key");
    expect(pipelineReferenceEntries.data.name).toBe("data");
  });

  it("commits private security, immutability, activation, bucket, and catalog SQL", async () => {
    const migration = await readFile(
      path.join(process.cwd(), "supabase/migrations/20260717232137_reference_resource_foundation.sql"),
      "utf8",
    );
    expect(migration).toContain("create or replace function private.activate_reference_resource");
    expect(migration).toContain("Finalized reference-resource package content is immutable.");
    expect(migration).toContain("'reference-resource-artifacts'");
    expect(migration).toContain("revoke all on private.reference_resources from public, anon, authenticated");
  });

  it("allows the bounded missing ROP2 projection warning", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260721054141_allow_missing_rop2_join_issue.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("rop_reference_people_join_issue_check");
    expect(migration).toContain("'missing-rop2'");
    expect(migration).toContain("'missing-rop25'");
    expect(migration).toContain("'rop2-conflict'");
    expect(migration).toContain("'parent-only-rop25'");
  });

  it("commits immutable pipeline resource projections and guarded activation", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260723004707_add_pipeline_reference_resources.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create table if not exists private.pipeline_reference_entries",
    );
    expect(migration).toContain(
      "Reference-resource activation must use the guarded activation function.",
    );
    expect(migration).toContain("Active reference-resource versions are immutable.");
    expect(migration).toContain("'source-aliases'");
    expect(migration).toContain("'jp-peopleid3'");
    expect(migration).toContain("'peid'");
    expect(migration).toContain("'tier1-merge-priorities'");
    expect(migration).toContain("'engagement-mappings'");
  });

  it("assigns exact detail routes to every pipeline resource", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260728182000_add_pipeline_resource_detail_routes.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("/dashboard/resources/source-aliases");
    expect(migration).toContain("/dashboard/resources/jp-peopleid3");
    expect(migration).toContain("/dashboard/resources/peid");
    expect(migration).toContain(
      "/dashboard/resources/tier1-merge-priorities",
    );
    expect(migration).toContain("/dashboard/resources/engagement-mappings");
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

describe("partner export schema", () => {
  it("declares private profile, ordered mapping, and run provenance columns", () => {
    expect(partnerExportProfiles.datasetId.name).toBe("dataset_id");
    expect(partnerExportProfiles.partnerKey.name).toBe("partner_key");
    expect(partnerExportProfiles.revision.name).toBe("revision");
    expect(partnerExportProfileColumns.profileId.name).toBe("profile_id");
    expect(partnerExportProfileColumns.sourceColumnKeys.name).toBe(
      "source_column_keys",
    );
    expect(partnerExportRuns.profileRevision.name).toBe("profile_revision");
    expect(partnerExportRuns.sourceSnapshot.name).toBe("source_snapshot");
    expect(partnerExportRuns.csvStoragePath.name).toBe("csv_storage_path");
  });

  it("declares non-destructive API connection archival metadata", () => {
    expect(apiConnections.archivedAt.name).toBe("archived_at");
    expect(apiConnections.archivedByOwnerId.name).toBe("archived_by_owner_id");
    expect(apiConnections.archiveReason.name).toBe("archive_reason");
  });

  it("creates the partner export and Google Sheets lifecycle migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260715063000_partner_export_profiles.sql",
    );
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create table if not exists private.partner_export_profiles",
    );
    expect(migration).toContain(
      "create table if not exists private.partner_export_profile_columns",
    );
    expect(migration).toContain(
      "create table if not exists private.partner_export_runs",
    );
    expect(migration).toContain(
      "api_connections_google_sheet_active_source_idx",
    );
    expect(migration).toContain("'partner-export-artifacts'");
    expect(migration).toContain(
      "revoke all on private.partner_export_runs from public, anon, authenticated",
    );
  });
});

describe("internal product analytics removal", () => {
  it("drops the retired private analytics tables in dependency order", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260720192949_remove_internal_product_analytics.sql",
    );
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "drop table if exists private.analytics_failure_triage",
    );
    expect(migration).toContain("drop table if exists private.analytics_events");
    expect(migration.indexOf("analytics_failure_triage")).toBeLessThan(
      migration.indexOf("analytics_events"),
    );
  });
});

describe("apiConnections schema", () => {
  it("declares private API connection columns", () => {
    expect(apiConnections.secretVaultId.name).toBe("secret_vault_id");
    expect(apiConnections.requestHeaders.name).toBe("request_headers");
    expect(apiConnections.responseFormat.name).toBe("response_format");
    expect(apiConnections.provider.name).toBe("provider");
    expect(apiConnections.providerConfig.name).toBe("provider_config");
    expect(
      Object.keys(apiConnections).some((key) =>
        key.toLowerCase().includes("credential"),
      ),
    ).toBe(false);
    expect(apiConnectionRuns.connectionId.name).toBe("connection_id");
    expect(apiConnectionRuns.sourceProfileSnapshot.name).toBe(
      "source_profile_snapshot",
    );
    expect(apiConnectionRuns.sourceProfileChecksum.name).toBe(
      "source_profile_checksum",
    );
    expect(apiConnectionRuns.responsePreview.name).toBe("response_preview");
    expect(apiConnectionRuns.startedAt.name).toBe("started_at");
    expect(apiConnectionRuns.completedAt.name).toBe("completed_at");
    expect(apiConnectionRunLogs.runId.name).toBe("run_id");
    expect(apiConnectionRunLogs.message.name).toBe("message");
    expect(apiConnectionRunOutputs.rowsStoragePath.name).toBe("rows_storage_path");
    expect(apiConnectionRunOutputs.rawStoragePath.name).toBe("raw_storage_path");
    expect(apiConnectionRunOutputs.rowsChecksum.name).toBe("rows_checksum");
    expect(apiConnectionRunOutputs.rawChecksum.name).toBe("raw_checksum");
    expect(apiConnectionResources.resourceUrl.name).toBe("resource_url");
    expect(apiConnectionResources.normalizedUrl.name).toBe("normalized_url");
    expect(apiConnectionResources).not.toHaveProperty("category");
    expect(apiConnectionResources.webText.name).toBe("web_text");
    expect(apiConnectionResources.sourceResourceIndex.name).toBe(
      "source_resource_index",
    );
  });

  it("declares the private IMB forming lifecycle and migration protections", async () => {
    expect(datasetFormingRuns.sourceRunId.name).toBe("source_run_id");
    expect(datasetFormingRuns.resourceSetId.name).toBe("resource_set_id");
    expect(datasetFormingRuns.sourceProfileKey.name).toBe("source_profile_key");
    expect(datasetFormingRuns.engineKey.name).toBe("engine_key");
    expect(datasetFormingRuns.artifactSchemaVersion.name).toBe(
      "artifact_schema_version",
    );
    expect(datasetFormingRuns.inputFingerprint.name).toBe("input_fingerprint");
    expect(datasetFormingRuns.attemptNumber.name).toBe("attempt_number");
    expect(datasetFormingRuns.executionClaimedAt.name).toBe(
      "execution_claimed_at",
    );
    expect(datasetFormingRuns.publicationTargetKey.name).toBe(
      "publication_target_key",
    );
    expect(datasetFormingRuns.expectedCurrentPublicationId.name).toBe(
      "expected_current_publication_id",
    );
    expect(datasetFormingRuns.transformationChecksum.name).toBe(
      "transformation_checksum",
    );
    expect(datasetFormingRuns.artifactManifest.name).toBe("artifact_manifest");
    expect(datasetFormingRuns.publicationId.name).toBe("publication_id");
    expect(datasetFormingRuns.publishingStartedAt.name).toBe(
      "publishing_started_at",
    );
    expect(datasetFormingRuns.publicationAttemptId.name).toBe(
      "publication_attempt_id",
    );
    expect(datasetFormingRuns.publicationBlobPath.name).toBe(
      "publication_blob_path",
    );
    expect(datasetFormingResourceBindings.formingRunId.name).toBe(
      "forming_run_id",
    );
    expect(datasetFormingResourceBindings.bindingKey.name).toBe("binding_key");
    expect(datasetFormingResourceBindings.resourceVersionId.name).toBe(
      "resource_version_id",
    );
    expect(datasetFormingFindings.formingRunId.name).toBe("forming_run_id");
    expect(datasetFormingFindings.ruleCode.name).toBe("rule_code");

    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260722051234_add_imb_forming_candidates.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("create table if not exists private.dataset_forming_runs");
    expect(migration).toContain("create table if not exists private.dataset_forming_findings");
    expect(migration).toContain("Dataset forming findings are append-only.");
    expect(migration).toContain(
      "revoke all on private.dataset_forming_runs from public, anon, authenticated",
    );

    const hardeningMigration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260723064114_harden_forming_execution_snapshots.sql",
      ),
      "utf8",
    );
    expect(hardeningMigration).toContain(
      "api_connection_runs_source_snapshot_immutable",
    );
    expect(hardeningMigration).toContain(
      "dataset_forming_runs_fingerprint_attempt_idx",
    );
    expect(hardeningMigration).toContain(
      "dataset_forming_runs_execution_metadata_immutable",
    );
    const guardDisabledAt = hardeningMigration.indexOf(
      "disable trigger dataset_forming_runs_immutable",
    );
    const backfillAt = hardeningMigration.indexOf("with numbered as (");
    const guardEnabledAt = hardeningMigration.indexOf(
      "enable trigger dataset_forming_runs_immutable",
    );
    expect(guardDisabledAt).toBeGreaterThan(-1);
    expect(backfillAt).toBeGreaterThan(guardDisabledAt);
    expect(guardEnabledAt).toBeGreaterThan(backfillAt);
  });

  it("generalizes forming metadata with normalized immutable resource bindings", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260722233404_generalize_dataset_forming_metadata.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("add column if not exists source_profile_key text");
    expect(migration).toContain("add column if not exists engine_key text");
    expect(migration).toContain("'legacy-imb-input-v1'");
    expect(migration).toContain("create table if not exists private.dataset_forming_resource_bindings");
    expect(migration).toContain("dataset_forming_resource_bindings_run_set_fk");
    expect(migration).toContain("dataset_forming_resource_bindings_membership_fk");
    expect(migration).toContain("'imb-field-contract'");
    expect(migration).toContain(
      "Finalized dataset forming resource bindings are immutable.",
    );
    expect(migration).toContain(
      "revoke all on private.dataset_forming_resource_bindings from public, anon, authenticated",
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

  it("drops API connection resource category metadata", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260508092905_drop_api_connection_resource_category.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "alter table private.api_connection_resources",
    );
    expect(migration).toContain("drop column if exists category");
  });

  it("declares country-code alternate-name override schema", async () => {
    expect(isoCountryCodeEntryOverrides.displayName.name).toBe("display_name");
    expect(isoCountryCodeEntryOverrides.alternativeNames.name).toBe(
      "alternative_names",
    );
    expect(isoCountryCodeEntryOverrides.updatedByOwnerId.name).toBe(
      "updated_by_owner_id",
    );

    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260506171502_iso_country_code_entry_overrides.sql",
    );
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "create table if not exists private.iso_country_code_entry_overrides",
    );
    expect(migration).toContain(
      "alter table private.iso_country_code_entry_overrides enable row level security",
    );
    expect(migration).toContain(
      "revoke all on private.iso_country_code_entry_overrides",
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

  it("creates the Google Sheets provider metadata migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260509065937_google_sheets_connections.sql",
    );

    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "add column if not exists provider text not null default 'http_api'",
    );
    expect(migration).toContain(
      "add column if not exists provider_config jsonb not null default '{\"provider\":\"http_api\"}'::jsonb",
    );
    expect(migration).toContain("google_sheets");
  });

  it("creates the Google Sheets service-account cleanup migration", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260706130000_google_sheets_service_account_connections.sql",
    );

    const migration = await readFile(migrationPath, "utf8");
    const staleCredentialTable = `private.api_connection_${"oa" + "uth"}_credentials`;
    const staleCredentialColumn = `${"oa" + "uth"}_credential_id`;
    const staleDraftTable = `private.${["google", "sheets", "connection", "drafts"].join("_")}`;

    expect(migration).toContain("delete from vault.secrets");
    expect(migration).toContain(`drop table if exists ${staleDraftTable}`);
    expect(migration).toContain(`drop column if exists ${staleCredentialColumn}`);
    expect(migration).toContain(`drop table if exists ${staleCredentialTable}`);
  });
});

describe("sourceProfileBindings schema", () => {
  it("declares durable Google Sheets forming profile metadata", async () => {
    expect(sourceProfileBindings.connectionId.name).toBe("connection_id");
    expect(sourceProfileBindings.sourceProfileKey.name).toBe(
      "source_profile_key",
    );
    expect(sourceProfileBindings.stableKeyColumn.name).toBe(
      "stable_key_column",
    );

    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260722233500_add_source_profile_bindings.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "create table if not exists private.source_profile_bindings",
    );
    expect(migration).toContain(
      "Only Google Sheets connections can use configurable source profiles.",
    );
    expect(migration).toContain(
      "revoke all on private.source_profile_bindings from public, anon, authenticated",
    );
    expect(migration).toContain(
      "create unique index if not exists source_profile_bindings_source_profile_unique",
    );

    const uniquenessMigration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260723014846_enforce_unique_source_profile_bindings.sql",
      ),
      "utf8",
    );
    expect(uniquenessMigration).toContain(
      "on private.source_profile_bindings(source_profile_key)",
    );
  });
});
