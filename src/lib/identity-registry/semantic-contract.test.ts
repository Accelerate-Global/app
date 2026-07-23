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
  "rop3-code-generation",
  "rop3-source-pair-invalid",
  "rop3-source-pair-collision",
  "rop3-source-pair-retained-with-generated-aliases",
  "rop3-generated-reservation",
  "no-rop3-source-pair-invalid",
  "no-rop3-source-pair-iso-mismatch",
  "no-rop3-source-pair-retained",
  "explicit-code-or-value-collision",
  "allocated-counter-missing-or-exhausted",
  "allocated-binding-reuse",
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
      "7c44588ea17c3402f03bd4b6ea5e366475759c2c97eae0bb8879251ebc958bfe",
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
