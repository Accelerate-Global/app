import {
  archiveApiRetentionPolicySchema,
  archiveStorageCriticalBytes,
  archiveStorageWarningBytes,
  canonicalSha256,
  dataArchiveSchemaVersion,
  prunePlanSchema,
  type PrunePlan,
  type ArchiveApiRetentionPlanPolicy,
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
  retentionPolicy: ArchiveApiRetentionPlanPolicy = {
    minimumAgeDays: 30,
    hotVersionsPerConnection: 3,
  },
): ArchiveEligibilityDecision {
  const policy = archiveApiRetentionPolicySchema.parse(retentionPolicy);
  const reasons: string[] = [];
  const age = ageInDays(candidate.sourceCreatedAt, now);
  if (!Number.isFinite(age) || age < policy.minimumAgeDays) {
    reasons.push(`younger-than-${policy.minimumAgeDays}-days`);
  }
  if (candidate.validRank <= policy.hotVersionsPerConnection) {
    reasons.push(`inside-latest-${policy.hotVersionsPerConnection}-valid`);
  }
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
  retentionPolicy: ArchiveApiRetentionPlanPolicy;
  currentStorageBytes: number;
}): {
  plan: PrunePlan;
  planSha256: string;
  decisions: ArchiveEligibilityDecision[];
} {
  const candidates = [...input.candidates].sort((left, right) =>
    left.packageKey.localeCompare(right.packageKey),
  );
  const retentionPolicy = archiveApiRetentionPolicySchema.parse(input.retentionPolicy);
  if (!Number.isSafeInteger(input.currentStorageBytes) || input.currentStorageBytes < 0) {
    throw new Error("archive_current_storage_bytes_invalid");
  }
  const decisions = candidates.map((candidate) =>
    evaluateArchiveEligibility(candidate, input.generatedAt, retentionPolicy),
  );
  const sourceStateSha256 = canonicalSha256(
    {
      retentionPolicy,
      candidates: candidates.map(archiveDependencyState),
    },
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
          `older-than-${retentionPolicy.minimumAgeDays}-days`,
          `outside-latest-${retentionPolicy.hotVersionsPerConnection}-valid`,
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
  const verificationRequiredPackageKeys = decisions
    .filter((decision) =>
      decision.reasons.length === 1 &&
      decision.reasons[0] === "restore-proof-missing"
    )
    .map((decision) => decision.candidate.packageKey)
    .sort();
  const totalBytes = items.reduce((total, item) => total + item.sizeBytes, 0);
  const plan = prunePlanSchema.parse({
    schemaVersion: dataArchiveSchemaVersion,
    planKey: input.planKey,
    generatedAt: input.generatedAt.toISOString(),
    sourceStateSha256,
    retentionPolicy,
    currentStorageBytes: input.currentStorageBytes,
    plannedRemovalBytes: totalBytes,
    projectedStorageBytes: Math.max(0, input.currentStorageBytes - totalBytes),
    storageWarningBytes: archiveStorageWarningBytes,
    storageCriticalBytes: archiveStorageCriticalBytes,
    verificationRequiredPackageKeys,
    productionDeletionEnabled: false,
    items,
    itemCount: items.length,
    totalBytes,
  });
  return { plan, planSha256: canonicalSha256(plan), decisions };
}
