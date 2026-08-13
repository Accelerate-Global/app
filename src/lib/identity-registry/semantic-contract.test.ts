import { describe, expect, it } from "vitest";

import {
  AX_IDENTITY_RULES_CHECKSUM,
  AX_IDENTITY_SEMANTIC_CONTRACT,
  canonicalizeAxIdentitySemanticContract,
  checksumAxIdentitySemanticContract,
} from "./semantic-contract";

const EXPECTED_BRANCH_KEYS = [
  "stable-key-missing",
  "stable-key-duplicate",
  "existing-binding-reuse",
  "existing-binding-identity-change",
  "rop3-parent-validation",
  "rop3-current-evidence-reuse",
  "rop3-current-evidence-reservation",
  "source-supplied-ax-code-inertness",
  "pgac-only",
  "pgic-geography-required",
  "allocated-counter-missing-or-exhausted",
  "allocated-next-value-reservation",
  "row-rule-error",
  "candidate-validity",
  "exact-input-reuse",
  "exact-input-concurrent-reuse",
  "exact-input-terminal-retry",
  "reservation-window",
  "reservation-cancellation-without-recycling",
] as const;

function expectRecursivelyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) {
    expectRecursivelyFrozen(child);
  }
}

describe("AX identity semantic contract", () => {
  it("locks the complete reconciliation, allocation, reservation, and retry branch inventory", () => {
    expect(AX_IDENTITY_SEMANTIC_CONTRACT.branches.map((branch) => branch.key)).toEqual(
      EXPECTED_BRANCH_KEYS,
    );
    expect(new Set(EXPECTED_BRANCH_KEYS).size).toBe(EXPECTED_BRANCH_KEYS.length);
    expect(AX_IDENTITY_SEMANTIC_CONTRACT.exactInputFingerprint).toContain(
      "this semantic contract checksum",
    );
  });

  it("is recursively immutable and canonically serialized", () => {
    expectRecursivelyFrozen(AX_IDENTITY_SEMANTIC_CONTRACT);
    expect(canonicalizeAxIdentitySemanticContract({ z: 1, a: { y: 2, x: 3 } }))
      .toBe(canonicalizeAxIdentitySemanticContract({ a: { x: 3, y: 2 }, z: 1 }));
  });

  it("locks the reviewed semantic checksum", () => {
    expect(AX_IDENTITY_RULES_CHECKSUM).toBe(
      "469173320cb943bb1cc8cfae59afb0a1768f0b60a505a12a9b684069eb27e19d",
    );
    expect(checksumAxIdentitySemanticContract(AX_IDENTITY_SEMANTIC_CONTRACT)).toBe(
      AX_IDENTITY_RULES_CHECKSUM,
    );
  });

  it("changes the checksum when any executed branch contract changes", () => {
    for (const branchKey of EXPECTED_BRANCH_KEYS) {
      const changedContract = {
        ...AX_IDENTITY_SEMANTIC_CONTRACT,
        branches: AX_IDENTITY_SEMANTIC_CONTRACT.branches.map((branch) =>
          branch.key === branchKey
            ? { ...branch, outcome: `${branch.outcome} [changed]` }
            : branch
        ),
      };
      expect(
        checksumAxIdentitySemanticContract(changedContract),
        branchKey,
      ).not.toBe(AX_IDENTITY_RULES_CHECKSUM);
    }
  });
});
