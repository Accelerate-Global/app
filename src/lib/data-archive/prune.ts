import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  dataArchivePackageMembers,
  dataArchivePackages,
  dataArchivePruneItems,
  dataArchivePrunePlans,
} from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { canonicalSha256, prunePlanSchema } from "./canonical";
import {
  archiveDependencyKinds,
  buildArchivePrunePlan,
  type ArchiveDependencyKind,
  type ArchiveEligibilityCandidate,
} from "./eligibility";

type CandidateRow = {
  run_id: string;
  run_created_at: Date | string;
  valid_rank: number;
  dataset_id: string | null;
  package_id: string | null;
  package_key: string | null;
  package_status: ArchiveEligibilityCandidate["packageStatus"];
  integrity_verified_at: Date | string | null;
  restore_verified_at: Date | string | null;
  receipt_verified: boolean;
  active_target_ids: string[];
  open_work_ids: string[];
  candidate_ids: string[];
  publication_ids: string[];
  release_ids: string[];
  resource_set_ids: string[];
  registry_revision_ids: string[];
  downstream_lineage_ids: string[];
};

type MemberRow = {
  package_id: string;
  member_id: string;
  storage_bucket: string;
  storage_object_name: string;
  size_bytes: number;
  content_checksum: string;
  hot_state: ArchiveEligibilityCandidate["objects"][number]["hotState"];
  shared_reference_count: number;
};

function emptyDependencies(): Record<ArchiveDependencyKind, string[]> {
  return Object.fromEntries(
    archiveDependencyKinds.map((kind) => [kind, []]),
  ) as unknown as Record<ArchiveDependencyKind, string[]>;
}

export async function loadApiArtifactEligibilityCandidates(): Promise<
  ArchiveEligibilityCandidate[]
> {
  const db = getDb();
  const rows = (await db.execute(sql<CandidateRow>`
    with ranked_runs as (
      select run.*,
        row_number() over (
          partition by run.connection_id
          order by run.created_at desc, run.id desc
        )::integer as valid_rank
      from private.api_connection_runs as run
      where run.status = 'success'
    )
    select run.id as run_id, run.created_at as run_created_at, run.valid_rank,
      run.dataset_id,
      archive_package.id as package_id,
      archive_package.package_key,
      archive_package.status as package_status,
      archive_package.integrity_verified_at,
      archive_package.restore_verified_at,
      coalesce(exists (
        select 1
        from private.data_archive_receipts as receipt
        join private.data_archive_backup_runs as backup
          on backup.id = receipt.backup_run_id
        where backup.id = archive_package.backup_run_id
          and backup.status = 'verified'
          and backup.integrity_verified_at is not null
      ), false) as receipt_verified,
      case when run.dataset_id is null then array[]::text[] else array[run.dataset_id::text] end as active_target_ids,
      array(
        select forming.id::text
        from private.dataset_forming_runs as forming
        where forming.source_run_id = run.id
          and forming.status in ('building', 'valid', 'publishing')
        order by forming.id
      ) as open_work_ids,
      array(
        select forming.id::text
        from private.dataset_forming_runs as forming
        where forming.source_run_id = run.id
        order by forming.id
      ) as candidate_ids,
      array(
        select forming.publication_id::text
        from private.dataset_forming_runs as forming
        where forming.source_run_id = run.id
          and forming.publication_id is not null
        order by forming.publication_id
      ) as publication_ids,
      array(
        select distinct publication.release_set_id::text
        from private.dataset_forming_runs as forming
        join private.pipeline_publications as publication
          on publication.id = forming.publication_id
        where forming.source_run_id = run.id
          and publication.release_set_id is not null
        order by publication.release_set_id::text
      ) as release_ids,
      array(
        select distinct forming.resource_set_id::text
        from private.dataset_forming_runs as forming
        where forming.source_run_id = run.id
        order by forming.resource_set_id::text
      ) as resource_set_ids,
      array(
        select distinct publication.registry_revision_id::text
        from private.dataset_forming_runs as forming
        join private.pipeline_publications as publication
          on publication.id = forming.publication_id
        where forming.source_run_id = run.id
          and publication.registry_revision_id is not null
        order by publication.registry_revision_id::text
      ) as registry_revision_ids,
      array(
        select forming.id::text
        from private.dataset_forming_runs as forming
        where forming.source_run_id = run.id
        order by forming.id
      ) as downstream_lineage_ids
    from ranked_runs as run
    join private.api_connection_run_outputs as output on output.run_id = run.id
    left join lateral (
      select package.*
      from private.data_archive_packages as package
      where package.package_kind = 'api-run'
        and package.source_identifier = run.id::text
      order by package.source_created_at desc, package.created_at desc
      limit 1
    ) as archive_package on true
    order by run.created_at, run.id
  `)) as unknown as CandidateRow[];
  const packageIds = rows
    .map((row) => row.package_id)
    .filter((id): id is string => Boolean(id));
  const members = packageIds.length === 0
    ? []
    : (await db.execute(sql<MemberRow>`
        select member.package_id, member.id as member_id,
          member.storage_bucket, member.storage_object_name,
          member.size_bytes, member.content_checksum, member.hot_state,
          (
            select count(*)::integer
            from private.api_connection_run_outputs as other_output
            where other_output.rows_storage_path = member.storage_object_name
               or other_output.raw_storage_path = member.storage_object_name
          ) as shared_reference_count
        from private.data_archive_package_members as member
        where member.package_id = any(${packageIds}::uuid[])
          and member.storage_bucket is not null
          and member.storage_object_name is not null
        order by member.package_id, member.storage_bucket, member.storage_object_name
      `)) as unknown as MemberRow[];
  const membersByPackage = new Map<string, MemberRow[]>();
  for (const member of members) {
    membersByPackage.set(member.package_id, [
      ...(membersByPackage.get(member.package_id) ?? []),
      member,
    ]);
  }
  return rows.map((row) => {
    const dependencies = emptyDependencies();
    dependencies["active-targets"] = row.active_target_ids ?? [];
    dependencies["open-or-retryable-work"] = row.open_work_ids ?? [];
    dependencies.candidates = row.candidate_ids ?? [];
    dependencies.publications = row.publication_ids ?? [];
    dependencies.releases = row.release_ids ?? [];
    dependencies["resource-sets"] = row.resource_set_ids ?? [];
    dependencies["registry-revisions"] = row.registry_revision_ids ?? [];
    dependencies["downstream-lineage"] = row.downstream_lineage_ids ?? [];
    const objects = row.package_id
      ? (membersByPackage.get(row.package_id) ?? []).map((member) => ({
          memberId: member.member_id,
          bucket: member.storage_bucket,
          path: member.storage_object_name,
          sizeBytes: member.size_bytes,
          contentChecksum: member.content_checksum,
          hotState: member.hot_state,
          sharedReferenceCount: member.shared_reference_count,
        }))
      : [];
    dependencies["storage-owners"] = objects
      .filter((object) => object.sharedReferenceCount > 1)
      .map((object) => object.memberId);
    return {
      packageId: row.package_id ?? `missing:${row.run_id}`,
      packageKey: row.package_key ?? `missing:${row.run_id}`,
      packageKind: "api-run" as const,
      sourceIdentifier: row.run_id,
      sourceCreatedAt: new Date(row.run_created_at).toISOString(),
      validRank: row.valid_rank,
      packageStatus: row.package_status,
      receiptVerified: row.receipt_verified,
      integrityVerified: Boolean(row.integrity_verified_at),
      restoreVerified: Boolean(row.restore_verified_at),
      checksComplete: true,
      dependencies,
      objects,
    };
  });
}

export async function generateApiArtifactPrunePlan(input: {
  now: Date;
  planKey: string;
}) {
  return buildArchivePrunePlan({
    planKey: input.planKey,
    generatedAt: input.now,
    candidates: await loadApiArtifactEligibilityCandidates(),
  });
}

function parseItemIdentity(value: string): { bucket: string; path: string } {
  const delimiter = value.indexOf(":");
  if (delimiter <= 0 || delimiter === value.length - 1) {
    throw new Error("archive_prune_item_identity_invalid");
  }
  const bucket = value.slice(0, delimiter);
  const path = value.slice(delimiter + 1);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(bucket) || !path || path.includes("\0")) {
    throw new Error("archive_prune_item_identity_invalid");
  }
  return { bucket, path };
}

async function assertLockedApiRunStillEligible(input: {
  sourceIdentifier: string;
  objectPath: string;
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
}) {
  const rows = (await input.executor.execute(sql<{
    valid_rank: number;
    dataset_id: string | null;
    dependency_count: number;
    shared_reference_count: number;
  }>`
    with ranked as (
      select id, dataset_id,
        row_number() over (
          partition by connection_id order by created_at desc, id desc
        )::integer as valid_rank
      from private.api_connection_runs
      where status = 'success'
    )
    select ranked.valid_rank, ranked.dataset_id,
      (select count(*)::integer from private.dataset_forming_runs where source_run_id = ranked.id) as dependency_count,
      (select count(*)::integer from private.api_connection_run_outputs
        where rows_storage_path = ${input.objectPath}
           or raw_storage_path = ${input.objectPath}) as shared_reference_count
    from ranked
    where ranked.id = ${input.sourceIdentifier}::uuid
    for update
  `)) as unknown as Array<{
    valid_rank: number;
    dataset_id: string | null;
    dependency_count: number;
    shared_reference_count: number;
  }>;
  const row = rows[0];
  if (
    !row ||
    row.valid_rank <= 3 ||
    row.dataset_id !== null ||
    row.dependency_count !== 0 ||
    row.shared_reference_count !== 1
  ) {
    throw new Error("archive_prune_plan_stale");
  }
}

export async function applyApiArtifactPrunePlan(input: {
  value: unknown;
  confirmedChecksum: string;
  approvedByOwnerId: string;
  productionDeletionEnabled: boolean;
}) {
  if (!input.productionDeletionEnabled) {
    throw new Error("archive_production_prune_disabled");
  }
  const plan = prunePlanSchema.parse(input.value);
  const planChecksum = canonicalSha256(plan);
  if (planChecksum !== input.confirmedChecksum) {
    throw new Error("archive_prune_checksum_mismatch");
  }
  const candidates = await loadApiArtifactEligibilityCandidates();
  const regenerated = buildArchivePrunePlan({
    planKey: plan.planKey,
    generatedAt: new Date(plan.generatedAt),
    candidates,
  });
  if (regenerated.plan.sourceStateSha256 !== plan.sourceStateSha256) {
    throw new Error("archive_prune_plan_stale");
  }
  const candidateByPackageKey = new Map(
    candidates.map((candidate) => [candidate.packageKey, candidate]),
  );
  const db = getDb();
  const [existingPlan] = await db
    .select()
    .from(dataArchivePrunePlans)
    .where(eq(dataArchivePrunePlans.planKey, plan.planKey))
    .limit(1);
  let planId = existingPlan?.id;
  if (existingPlan) {
    if (
      existingPlan.planChecksum !== planChecksum ||
      existingPlan.sourceStateChecksum !== plan.sourceStateSha256 ||
      !["approved", "executing", "failed"].includes(existingPlan.status)
    ) {
      throw new Error("archive_prune_plan_conflict");
    }
  } else {
    const [created] = await db
      .insert(dataArchivePrunePlans)
      .values({
        planKey: plan.planKey,
        planChecksum,
        sourceStateChecksum: plan.sourceStateSha256,
        status: "approved",
        itemCount: plan.itemCount,
        totalBytes: plan.totalBytes,
        approvedByOwnerId: input.approvedByOwnerId,
        approvedAt: new Date(),
      })
      .returning({ id: dataArchivePrunePlans.id });
    if (!created) throw new Error("archive_prune_plan_not_created");
    planId = created.id;
    await db.insert(dataArchivePruneItems).values(
      plan.items.map((item) => {
        const candidate = candidateByPackageKey.get(item.packageKey);
        const identity = parseItemIdentity(item.itemIdentifier);
        const member = candidate?.objects.find(
          (object) => object.bucket === identity.bucket && object.path === identity.path,
        );
        if (!candidate || !member) throw new Error("archive_prune_member_missing");
        return {
          planId: created.id,
          packageId: candidate.packageId,
          packageMemberId: member.memberId,
          itemKind: item.itemKind,
          itemIdentifier: item.itemIdentifier,
          sizeBytes: item.sizeBytes,
          status: "planned" as const,
        };
      }),
    );
  }
  if (!planId) throw new Error("archive_prune_plan_missing");
  await db
    .update(dataArchivePrunePlans)
    .set({
      status: "executing",
      startedAt: new Date(),
      completedAt: null,
      failureCode: null,
      updatedAt: new Date(),
    })
    .where(eq(dataArchivePrunePlans.id, planId));

  const storage = createSupabaseAdminClient().storage;
  for (const item of plan.items) {
    const candidate = candidateByPackageKey.get(item.packageKey);
    if (!candidate) throw new Error("archive_prune_candidate_missing");
    const identity = parseItemIdentity(item.itemIdentifier);
    const member = candidate.objects.find(
      (object) => object.bucket === identity.bucket && object.path === identity.path,
    );
    if (!member) throw new Error("archive_prune_member_missing");
    const result = await db.transaction(async (tx) => {
      const [storedItem] = await tx
        .select()
        .from(dataArchivePruneItems)
        .where(
          and(
            eq(dataArchivePruneItems.planId, planId!),
            eq(dataArchivePruneItems.itemIdentifier, item.itemIdentifier),
          ),
        )
        .limit(1)
        .for("update");
      if (!storedItem) throw new Error("archive_prune_item_missing");
      if (storedItem.status === "deleted") return { ok: true as const };
      await assertLockedApiRunStillEligible({
        sourceIdentifier: candidate.sourceIdentifier,
        objectPath: identity.path,
        executor: tx,
      });
      await tx
        .update(dataArchivePruneItems)
        .set({ status: "deleting", failureCode: null, updatedAt: new Date() })
        .where(eq(dataArchivePruneItems.id, storedItem.id));
      await tx
        .update(dataArchivePackageMembers)
        .set({ hotState: "deleting", updatedAt: new Date() })
        .where(eq(dataArchivePackageMembers.id, member.memberId));
      const removed = await storage.from(identity.bucket).remove([identity.path]);
      if (removed.error) {
        await tx
          .update(dataArchivePruneItems)
          .set({ status: "failed", failureCode: "storage-delete-failed", updatedAt: new Date() })
          .where(eq(dataArchivePruneItems.id, storedItem.id));
        await tx
          .update(dataArchivePackageMembers)
          .set({ hotState: "failed", updatedAt: new Date() })
          .where(eq(dataArchivePackageMembers.id, member.memberId));
        return { ok: false as const };
      }
      await tx
        .update(dataArchivePruneItems)
        .set({ status: "deleted", failureCode: null, updatedAt: new Date() })
        .where(eq(dataArchivePruneItems.id, storedItem.id));
      await tx
        .update(dataArchivePackageMembers)
        .set({ hotState: "cold", updatedAt: new Date() })
        .where(eq(dataArchivePackageMembers.id, member.memberId));
      return { ok: true as const };
    });
    if (!result.ok) {
      await db
        .update(dataArchivePrunePlans)
        .set({
          status: "failed",
          completedAt: new Date(),
          failureCode: "storage-delete-failed",
          updatedAt: new Date(),
        })
        .where(eq(dataArchivePrunePlans.id, planId));
      throw new Error("archive_prune_storage_delete_failed");
    }
  }

  await db.transaction(async (tx) => {
    const packageIds = [...new Set(
      plan.items.map((item) => candidateByPackageKey.get(item.packageKey)!.packageId),
    )];
    const incomplete = await tx
      .select({ id: dataArchivePackageMembers.id })
      .from(dataArchivePackageMembers)
      .where(
        and(
          inArray(dataArchivePackageMembers.packageId, packageIds),
          sql`${dataArchivePackageMembers.hotState} <> 'cold'`,
        ),
      )
      .limit(1);
    if (incomplete.length > 0) throw new Error("archive_prune_partial_state");
    await tx
      .update(dataArchivePackages)
      .set({ status: "cold", prunedAt: new Date(), updatedAt: new Date() })
      .where(inArray(dataArchivePackages.id, packageIds));
    await tx
      .update(dataArchivePrunePlans)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(dataArchivePrunePlans.id, planId));
  });
  return { planId, deletedItemCount: plan.itemCount, deletedBytes: plan.totalBytes };
}
