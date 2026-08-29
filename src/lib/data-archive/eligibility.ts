import {
  canonicalSha256,
  dataArchiveSchemaVersion,
  prunePlanSchema,
  type PrunePlan,
} from "./canonical";

export const archiveDependencyKinds = [
  "active-targets",
  "open-or-retryable-work",
  "candidates",
  "publications",
  "releases",
  "resource-sets",
  "registry-revisions",
  "storage-owners",
  "downstream-lineage",
] as const;

export type ArchiveDependencyKind = (typeof archiveDependencyKinds)[number];

export type ArchiveEligibilityObject = {
  memberId: string;
  bucket: string;
  path: string;
  sizeBytes: number;
  contentChecksum: string;
  hotState: "hot" | "deleting" | "cold" | "rehydrated" | "failed";
  sharedReferenceCount: number;
};

export type ArchiveEligibilityCandidate = {
  packageId: string;
  packageKey: string;
  packageKind:
    | "api-run"
    | "dataset-version"
    | "tier1-publication"
    | "tier2-publication";
  sourceIdentifier: string;
  sourceCreatedAt: string;
  validRank: number;
  packageStatus: "verified" | "cold" | "rehydrating" | "rehydrated" | "failed" | null;
  receiptVerified: boolean;
  integrityVerified: boolean;
  restoreVerified: boolean;
  checksComplete: boolean;
  dependencies: Record<ArchiveDependencyKind, string[]>;
  objects: ArchiveEligibilityObject[];
};

export type ArchiveEligibilityDecision = {
  candidate: ArchiveEligibilityCandidate;
  eligible: boolean;
  reasons: string[];
};

function ageInDays(createdAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000);
}

export function evaluateArchiveEligibility(
  candidate: ArchiveEligibilityCandidate,
  now: Date,
): ArchiveEligibilityDecision {
  const reasons: string[] = [];
  const age = ageInDays(candidate.sourceCreatedAt, now);
  if (!Number.isFinite(age) || age < 30) reasons.push("younger-than-30-days");
  if (candidate.validRank <= 3) reasons.push("latest-three-valid");
  if (candidate.packageStatus !== "verified") reasons.push("archive-not-verified");
  if (!candidate.receiptVerified) reasons.push("signed-receipt-missing");
  if (!candidate.integrityVerified) reasons.push("integrity-proof-missing");
  if (!candidate.restoreVerified) reasons.push("restore-proof-missing");
  if (!candidate.checksComplete) reasons.push("dependency-check-incomplete");
  for (const kind of archiveDependencyKinds) {
    if (candidate.dependencies[kind].length > 0) reasons.push(`referenced:${kind}`);
  }
  if (candidate.objects.length === 0) reasons.push("archive-members-missing");
  if (candidate.objects.some((object) => object.hotState !== "hot")) {
    reasons.push("archive-member-not-hot");
  }
  if (candidate.objects.some((object) => object.sharedReferenceCount > 1)) {
    reasons.push("shared-storage-path");
  }
  return { candidate, eligible: reasons.length === 0, reasons };
}

export function archiveDependencyState(candidate: ArchiveEligibilityCandidate) {
  return {
    packageId: candidate.packageId,
    packageKey: candidate.packageKey,
    packageKind: candidate.packageKind,
    sourceIdentifier: candidate.sourceIdentifier,
    sourceCreatedAt: candidate.sourceCreatedAt,
    validRank: candidate.validRank,
    packageStatus: candidate.packageStatus,
    receiptVerified: candidate.receiptVerified,
    integrityVerified: candidate.integrityVerified,
    restoreVerified: candidate.restoreVerified,
    checksComplete: candidate.checksComplete,
    dependencies: candidate.dependencies,
    objects: candidate.objects.map((object) => ({
      memberId: object.memberId,
      bucket: object.bucket,
      path: object.path,
      sizeBytes: object.sizeBytes,
      contentChecksum: object.contentChecksum,
      sharedReferenceCount: object.sharedReferenceCount,
    })),
  };
}

export function buildArchivePrunePlan(input: {
  planKey: string;
  generatedAt: Date;
  candidates: ArchiveEligibilityCandidate[];
}): {
  plan: PrunePlan;
  planSha256: string;
  decisions: ArchiveEligibilityDecision[];
} {
  const candidates = [...input.candidates].sort((left, right) =>
    left.packageKey.localeCompare(right.packageKey),
  );
  const decisions = candidates.map((candidate) =>
    evaluateArchiveEligibility(candidate, input.generatedAt),
  );
  const sourceStateSha256 = canonicalSha256(
    candidates.map(archiveDependencyState),
  );
  const items = decisions
    .filter((decision) => decision.eligible)
    .flatMap((decision) =>
      decision.candidate.objects.map((object) => ({
        packageKey: decision.candidate.packageKey,
        itemKind: "storage-object" as const,
        itemIdentifier: `${object.bucket}:${object.path}`,
        sizeBytes: object.sizeBytes,
        reasons: [
          "older-than-30-days",
          "outside-latest-three-valid",
          "verified-archive-and-restore",
          "dependencies-clear",
        ],
      })),
    )
    .sort((left, right) =>
      `${left.packageKey}\u0000${left.itemIdentifier}`.localeCompare(
        `${right.packageKey}\u0000${right.itemIdentifier}`,
      ),
    );
  const plan = prunePlanSchema.parse({
    schemaVersion: dataArchiveSchemaVersion,
    planKey: input.planKey,
    generatedAt: input.generatedAt.toISOString(),
    sourceStateSha256,
    productionDeletionEnabled: false,
    items,
    itemCount: items.length,
    totalBytes: items.reduce((total, item) => total + item.sizeBytes, 0),
  });
  return { plan, planSha256: canonicalSha256(plan), decisions };
}
