import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const path = "supabase/migrations/20260723012000_add_identity_publication_targets.sql";

describe("AX identity stable publication target migration", () => {
  it("pins candidates, serializes each target, and replaces one prepared dataset safely", async () => {
    const source = await readFile(path, "utf8");
    expect(source).toContain("publication_target_key text");
    expect(source).toContain("where producer_kind = 'identity'");
    expect(source).toContain("drop trigger if exists pipeline_publications_immutable");
    expect(source).toContain("create trigger pipeline_publications_immutable");
    expect(source).toContain("drop trigger if exists ax_identity_runs_lifecycle");
    expect(source).toContain("create trigger ax_identity_runs_lifecycle");
    expect(source).toContain("expected_current_publication_id uuid");
    expect(source).toContain("publication_attempt_id uuid");
    expect(source).toContain("ax_identity_runs_publishing_target_idx");
    expect(source).toContain("ax_identity_runs_publication_pin_immutable");
    expect(source).toContain("finalize_ax_identity_publication");
    expect(source).toContain("current_publication_id is distinct from run_record.expected_current_publication_id");
    expect(source).toContain("dataset_row_evidence_checksum is distinct from run_record.row_evidence_checksum");
    expect(source).toContain("reason, publication_target_key\n  ) values");
    expect(source).toContain("revoke execute on function private.activate_ax_identity_run");
  });
});
