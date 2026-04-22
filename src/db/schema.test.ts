import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyticsEvents,
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
