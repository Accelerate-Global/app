import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const path = "supabase/migrations/20260722235434_add_tier1_pipeline_products.sql";
const publicationAttemptPath = "supabase/migrations/20260723005824_add_pipeline_publication_attempts.sql";

describe("Tier 1 pipeline product migration", () => {
  it("creates private, guarded, service-only release and candidate history", async () => {
    const source = await readFile(path, "utf8");
    for (const table of [
      "pipeline_definitions",
      "pipeline_release_sets",
      "pipeline_release_members",
      "pipeline_runs",
      "pipeline_run_inputs",
      "pipeline_artifacts",
      "pipeline_findings",
      "pipeline_publication_inputs",
    ]) {
      expect(source).toContain(`private.${table}`);
      expect(source).toContain(`alter table private.${table} enable row level security`);
      expect(source).toContain(`revoke all on private.${table} from public, anon, authenticated`);
    }
    expect(source).toContain("pipeline_release_sets_final_checksum_idx");
    expect(source).toContain("pipeline_runs_active_build_idx");
    expect(source).toContain("Finalized pipeline releases are immutable");
    expect(source).toContain("Pipeline evidence is append-only");
  });

  it("pins the runtime definition checksums rather than placeholders", async () => {
    const source = await readFile(path, "utf8");
    expect(source).toContain("is_workspace_visible boolean not null");
    expect(source).toContain("732a52ce030ead236c08c2a6810dd54129fb31b2fe0253072fa5177b22097b38");
    expect(source).toContain("f638957b5fbaefde243198f2389325c25a322931ef85331516c44e7bde828d59");
    expect(source).not.toContain("repeat('1', 64)");
  });

  it("adds an indexed attempt token for safe stale-publication recovery", async () => {
    const source = await readFile(publicationAttemptPath, "utf8");
    expect(source).toContain("publication_attempt_id uuid");
    expect(source).toContain("expected_current_publication_id uuid");
    expect(source).toContain("pipeline_runs_publishing_lease_idx");
    expect(source).toContain("pipeline_runs_publication_pin_immutable");
    expect(source).toContain("where status = 'publishing'");
    expect(source).toContain("revoke all on private.pipeline_runs from public, anon, authenticated");
  });
});
