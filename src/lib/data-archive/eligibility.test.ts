import { describe, expect, it } from "vitest";

import {
  archiveDependencyKinds,
  buildArchivePrunePlan,
  evaluateArchiveEligibility,
  type ArchiveEligibilityCandidate,
} from "./eligibility";

const dependencies = () => Object.fromEntries(
  archiveDependencyKinds.map((kind) => [kind, []]),
) as unknown as ArchiveEligibilityCandidate["dependencies"];

function candidate(
  overrides: Partial<ArchiveEligibilityCandidate> = {},
): ArchiveEligibilityCandidate {
  return {
    packageId: "package-one",
    packageKey: `api-run/run-one/${"a".repeat(64)}`,
    packageKind: "api-run",
    sourceIdentifier: "run-one",
    sourceCreatedAt: "2026-06-01T00:00:00.000Z",
    validRank: 4,
    packageStatus: "verified",
    receiptVerified: true,
    integrityVerified: true,
    restoreVerified: true,
    checksComplete: true,
    dependencies: dependencies(),
    objects: [
      {
        memberId: "member-one",
        bucket: "api-connection-artifacts",
        path: "run-one/rows.json",
        sizeBytes: 100,
        contentChecksum: "b".repeat(64),
        hotState: "hot",
        sharedReferenceCount: 1,
      },
    ],
    ...overrides,
  };
}

describe("archive eligibility", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("allows only old, dependency-free, fully verified evidence outside the latest three", () => {
    expect(evaluateArchiveEligibility(candidate(), now)).toMatchObject({ eligible: true });
    expect(evaluateArchiveEligibility(candidate({ validRank: 3 }), now).reasons)
      .toContain("latest-three-valid");
    expect(evaluateArchiveEligibility(candidate({ sourceCreatedAt: "2026-08-10T00:00:00.000Z" }), now).reasons)
      .toContain("younger-than-30-days");
    expect(evaluateArchiveEligibility(candidate({ restoreVerified: false }), now).reasons)
      .toContain("restore-proof-missing");
  });

  it.each(archiveDependencyKinds)("fails closed for %s dependencies", (kind) => {
    const withDependency = dependencies();
    withDependency[kind] = [`safe-${kind}-id`];
    expect(evaluateArchiveEligibility(candidate({ dependencies: withDependency }), now))
      .toMatchObject({ eligible: false, reasons: [`referenced:${kind}`] });
  });

  it("rejects incomplete checks, shared paths, and partial deletion state", () => {
    expect(evaluateArchiveEligibility(candidate({ checksComplete: false }), now).reasons)
      .toContain("dependency-check-incomplete");
    expect(evaluateArchiveEligibility(candidate({
      objects: [{ ...candidate().objects[0]!, sharedReferenceCount: 2 }],
    }), now).reasons).toContain("shared-storage-path");
    expect(evaluateArchiveEligibility(candidate({
      objects: [{ ...candidate().objects[0]!, hotState: "failed" }],
    }), now).reasons).toContain("archive-member-not-hot");
  });

  it("builds a deterministic non-deleting plan with only exact eligible objects", () => {
    const generatedAt = new Date("2026-08-27T12:00:00.000Z");
    const first = buildArchivePrunePlan({
      planKey: "api-artifacts:20260827",
      generatedAt,
      candidates: [candidate({ packageKey: `api-run/z/${"c".repeat(64)}` }), candidate()],
    });
    const second = buildArchivePrunePlan({
      planKey: "api-artifacts:20260827",
      generatedAt,
      candidates: [candidate(), candidate({ packageKey: `api-run/z/${"c".repeat(64)}` })],
    });
    expect(first.plan).toEqual(second.plan);
    expect(first.planSha256).toBe(second.planSha256);
    expect(first.plan.productionDeletionEnabled).toBe(false);
    expect(first.plan.itemCount).toBe(2);
    expect(first.plan.items[0]?.itemIdentifier).toBe(
      "api-connection-artifacts:run-one/rows.json",
    );
  });
});
