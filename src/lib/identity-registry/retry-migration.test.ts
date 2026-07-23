import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const path =
  "supabase/migrations/20260723021000_add_identity_build_attempts.sql";

describe("AX identity retry-attempt migration", () => {
  it("preserves terminal history while serializing one reusable exact-input build", async () => {
    const source = await readFile(path, "utf8");

    expect(source).toContain("attempt_number integer");
    expect(source).toContain("ax_identity_runs_input_attempt_unique");
    expect(source).toContain("ax_identity_runs_reusable_input_idx");
    expect(source).toContain(
      "where status not in ('failed', 'expired', 'rejected')",
    );
    expect(source).toContain("ax_identity_runs_attempt_number_immutable");
    expect(source).toContain("source-aliases");
    expect(source).toContain(
      "revoke all on function private.guard_ax_identity_attempt_number()",
    );
  });
});
