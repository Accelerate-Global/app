import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827025711_add_data_archive_catalog.sql",
  ),
  "utf8",
);

describe("Samson data archive migration", () => {
  it("creates the compact catalog and keeps it outside browser access", () => {
    for (const table of [
      "data_archive_backup_runs",
      "data_archive_receipts",
      "data_archive_packages",
      "data_archive_package_members",
      "data_archive_prune_plans",
      "data_archive_prune_items",
      "data_archive_rehydrations",
    ]) {
      expect(migration).toContain(`create table private.${table}`);
      expect(migration).toContain(`alter table private.${table} enable row level security`);
      expect(migration).toContain(
        `revoke all on private.${table} from public, anon, authenticated`,
      );
    }
  });

  it("constrains the database reader to read-only grants", () => {
    expect(migration).toContain("create role data_archive_backup_reader");
    expect(migration).toContain("default_transaction_read_only = on");
    expect(migration).toContain(
      "grant select on all tables in schema public, private, supabase_migrations",
    );
    expect(migration).not.toMatch(
      /grant\s+(?:insert|update|delete|truncate|all)\b[^;]*data_archive_backup_reader/i,
    );
  });

  it("locks managed Auth and Storage export to the database session", () => {
    expect(migration).toContain(
      "create or replace function private.data_archive_export_managed_rows",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "session_user <> 'data_archive_backup_reader' or auth.uid() is not null",
    );
    expect(migration).toContain("export_schema not in ('auth', 'storage')");
    expect(migration).toContain(
      "revoke all on function private.data_archive_export_managed_rows(text) from public, anon, authenticated, service_role",
    );
  });

  it("uses server-controlled app metadata for read-only Storage access", () => {
    expect(migration).toContain(
      "auth.jwt()->'app_metadata'->>'data_archive_role'",
    );
    expect(migration).toContain("for select\nto authenticated");
    expect(migration).not.toMatch(
      /create policy[\s\S]*?data_archive_role[\s\S]*?for (?:insert|update|delete|all)/i,
    );
  });

  it("guards terminal evidence and immutable records", () => {
    expect(migration).toContain("data_archive_backup_runs_terminal_check");
    expect(migration).toContain("data_archive_packages_state_check");
    expect(migration).toContain("data_archive_prune_plans_state_check");
    expect(migration).toContain("data_archive_rehydrations_state_check");
    expect(migration).toContain("Data archive receipts are immutable.");
    expect(migration).toContain(
      "Verified data archive package identity and evidence are immutable.",
    );
  });

  it("does not add unsafe catalog fields", () => {
    expect(migration).not.toMatch(
      /\b(?:payload_body|local_path|credential|recipient_address|recovery_key|restic_password)\b/i,
    );
  });
});
