import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { IMB_SOURCE_PROFILE_KEY } from "@/lib/dataset-forming/engines/imb";
import {
  ACCELERATE_SOURCE_PROFILE_KEY,
  ETNOPEDIA_SOURCE_PROFILE_KEY,
  JOSHUA_PROJECT_SOURCE_PROFILE_KEY,
  WCD_SOURCE_PROFILE_KEY,
} from "@/lib/source-forming";
import { checksumProductValue } from "@/lib/tier1-products";

import { PipelineProductError } from "./errors";
import {
  TIER1_RELEASE_INPUT_KEYS,
  type CreatePipelineReleaseCandidateInput,
  type DecidePipelineReleaseCandidateInput,
  type FinalizePipelineReleaseInput,
  type Tier1ReleaseInputKey,
} from "./types";

type ReleaseRow = {
  id: string;
  release_key: string;
  resource_set_id: string;
  registry_revision_id: string;
  rule_version: string;
  rule_checksum: string;
  rule_payload: unknown;
  status: "draft" | "finalized" | "cancelled";
  canonical_checksum: string | null;
  finalization_reason: string | null;
  finalized_at: Date | string | null;
  created_at: Date | string;
  is_superseded?: boolean;
};

type PublicationRow = {
  id: string;
  producer_kind: string;
  producer_run_id: string;
  source_profile_key: string | null;
  registry_revision_id: string | null;
  output_checksum: string;
  row_count: number;
  actual_row_count: number;
  publication_target_key: string | null;
  created_at: Date | string;
};

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

export function validateCreatePipelineReleaseCandidateInput(
  input: CreatePipelineReleaseCandidateInput,
) {
  if (!/^[a-z][a-z0-9-]*$/u.test(input.releaseKey)) {
    throw new PipelineProductError("Release key is invalid.", 400, "invalid-release-key");
  }
  if (!input.actorOwnerId.trim()) {
    throw new PipelineProductError("The release actor is required.", 400, "missing-actor");
  }
  if (!input.ruleVersion.trim()) {
    throw new PipelineProductError("A priority rule version is required.", 400, "missing-rule-version");
  }
  const calculatedRuleChecksum = checksumProductValue(input.priorities);
  if (calculatedRuleChecksum !== input.ruleChecksum) {
    throw new PipelineProductError(
      "The priority rule checksum no longer matches the selected rules.",
      409,
      "stale-rule-checksum",
    );
  }
  const keys = input.members.map((member) => member.inputKey);
  if (new Set(keys).size !== keys.length) {
    throw new PipelineProductError("Each release input may be selected only once.", 400, "duplicate-release-input");
  }
  const sorted = [...keys].sort();
  const expected = [...TIER1_RELEASE_INPUT_KEYS].sort();
  if (sorted.length !== expected.length || sorted.some((key, index) => key !== expected[index])) {
    throw new PipelineProductError(
      `A release requires exactly ${TIER1_RELEASE_INPUT_KEYS.join(", ")}.`,
      400,
      "incomplete-release",
    );
  }
  for (const member of input.members) {
    if (!/^[0-9a-f]{64}$/u.test(member.expectedChecksum)) {
      throw new PipelineProductError("A selected publication checksum is invalid.", 400, "invalid-publication-checksum");
    }
  }
}

function validateReleaseCandidateDecision(
  input: DecidePipelineReleaseCandidateInput,
  decisionLabel: "finalization" | "rejection",
) {
  if (!input.actorOwnerId.trim()) {
    throw new PipelineProductError(
      `The release ${decisionLabel} actor is required.`,
      400,
      "missing-actor",
    );
  }
  if (!input.reason.trim()) {
    throw new PipelineProductError(
      `A ${decisionLabel} reason is required.`,
      400,
      "missing-reason",
    );
  }
}

export function validateFinalizePipelineReleaseInput(
  input: FinalizePipelineReleaseInput,
) {
  validateCreatePipelineReleaseCandidateInput(input);
  validateReleaseCandidateDecision(
    {
      releaseSetId: "validation-only",
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      reason: input.reason,
    },
    "finalization",
  );
}

function mapRelease(row: ReleaseRow) {
  const decisionAt = iso(row.finalized_at);
  return {
    id: row.id,
    releaseKey: row.release_key,
    resourceSetId: row.resource_set_id,
    registryRevisionId: row.registry_revision_id,
    ruleVersion: row.rule_version,
    ruleChecksum: row.rule_checksum,
    priorities: Array.isArray(row.rule_payload) ? row.rule_payload : [],
    status: row.status,
    canonicalChecksum: row.canonical_checksum,
    finalizationReason: row.status === "finalized" ? row.finalization_reason : null,
    rejectionReason: row.status === "cancelled" ? row.finalization_reason : null,
    finalizedAt: row.status === "finalized" ? decisionAt : null,
    rejectedAt: row.status === "cancelled" ? decisionAt : null,
    createdAt: iso(row.created_at)!,
    isSuperseded: row.is_superseded ?? false,
  };
}

const TIER1_RELEASE_PROFILE_KEYS = new Map<string, Tier1ReleaseInputKey>([
  [ACCELERATE_SOURCE_PROFILE_KEY, "ax"],
  [ETNOPEDIA_SOURCE_PROFILE_KEY, "etno"],
  [IMB_SOURCE_PROFILE_KEY, "imb"],
  [JOSHUA_PROJECT_SOURCE_PROFILE_KEY, "jp"],
  [WCD_SOURCE_PROFILE_KEY, "wcd"],
]);

export function inferTier1ReleaseInputKey(sourceProfileKey: string | null): Tier1ReleaseInputKey | null {
  const value = sourceProfileKey?.trim().toLowerCase() ?? "";
  return TIER1_RELEASE_PROFILE_KEYS.get(value) ?? null;
}

export async function listEligibleIdentityPublications(limit = 250) {
  const rows = (await getDb().execute(sql<PublicationRow>`
    select publication.id, publication.producer_kind, publication.source_profile_key,
      publication.registry_revision_id, publication.output_checksum, publication.row_count,
      publication.publication_target_key, publication.created_at,
      (select count(*)::integer from private.pipeline_publication_rows as candidate_row
       where candidate_row.publication_id = publication.id) as actual_row_count
    from private.pipeline_publications as publication
    where publication.producer_kind = 'identity'
    order by publication.created_at desc, publication.id desc
    limit ${Math.max(1, Math.min(500, limit))}
  `)) as unknown as PublicationRow[];
  return rows.map((row) => ({
    id: row.id,
    sourceProfileKey: row.source_profile_key,
    suggestedInputKey: inferTier1ReleaseInputKey(row.source_profile_key),
    registryRevisionId: row.registry_revision_id,
    outputChecksum: row.output_checksum,
    rowCount: row.row_count,
    rowsPresent: row.actual_row_count === row.row_count,
    publicationTargetKey: row.publication_target_key,
    createdAt: iso(row.created_at)!,
  }));
}

export async function listPipelineReleaseSets(limit = 100) {
  const rows = (await getDb().execute(sql<ReleaseRow>`
    select release.*,
      exists (
        select 1
        from private.pipeline_release_members as member
        join private.pipeline_publications as retained on retained.id = member.publication_id
        join private.pipeline_publications as newer
          on newer.source_profile_key = retained.source_profile_key
         and newer.producer_kind = 'identity'
         and newer.created_at > retained.created_at
        where member.release_set_id = release.id
      ) as is_superseded
    from private.pipeline_release_sets as release
    order by created_at desc, id desc
    limit ${Math.max(1, Math.min(250, limit))}
  `)) as unknown as ReleaseRow[];
  return rows.map(mapRelease);
}

export async function createPipelineReleaseSetCandidate(
  input: CreatePipelineReleaseCandidateInput,
) {
  validateCreatePipelineReleaseCandidateInput(input);
  const orderedMembers = TIER1_RELEASE_INPUT_KEYS.map(
    (inputKey) => input.members.find((member) => member.inputKey === inputKey)!,
  );

  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`pipeline-release:${input.releaseKey}`}, 0))`);

    const resourceRows = (await tx.execute(sql<{ id: string }>`
      select id from private.reference_resource_sets where id = ${input.resourceSetId}::uuid for share
    `)) as unknown as { id: string }[];
    if (!resourceRows[0]) {
      throw new PipelineProductError("The selected reference resource set no longer exists.", 409, "missing-resource-set");
    }
    const revisionRows = (await tx.execute(sql<{ id: string; revision_number: number }>`
      select id, revision_number from private.ax_registry_revisions
      where id = ${input.registryRevisionId}::uuid for share
    `)) as unknown as { id: string; revision_number: number }[];
    if (!revisionRows[0]) {
      throw new PipelineProductError("The selected AX registry revision no longer exists.", 409, "missing-registry-revision");
    }

    const publicationIds = orderedMembers.map((member) => member.publicationId);
    const publicationRows = (await tx.execute(sql<PublicationRow>`
      select publication.id, publication.producer_kind, publication.producer_run_id,
        publication.source_profile_key,
        publication.registry_revision_id, publication.output_checksum, publication.row_count,
        publication.publication_target_key, publication.created_at,
        (select count(*)::integer from private.pipeline_publication_rows as candidate_row
         where candidate_row.publication_id = publication.id) as actual_row_count
      from private.pipeline_publications as publication
      where publication.id in (${sql.join(publicationIds.map((id) => sql`${id}::uuid`), sql`, `)})
      order by publication.id
      for share
    `)) as unknown as PublicationRow[];
    const byId = new Map(publicationRows.map((row) => [row.id, row]));
    for (const member of orderedMembers) {
      const publication = byId.get(member.publicationId);
      if (!publication) {
        throw new PipelineProductError(`The ${member.inputKey.toUpperCase()} publication no longer exists.`, 409, "missing-publication");
      }
      if (publication.producer_kind !== "identity") {
        throw new PipelineProductError("Tier 1 inputs must be published identity outputs.", 409, "incompatible-publication");
      }
      if (inferTier1ReleaseInputKey(publication.source_profile_key) !== member.inputKey) {
        throw new PipelineProductError(
          `The selected publication is not a ${member.inputKey.toUpperCase()} identity output.`,
          409,
          "source-profile-mismatch",
        );
      }
      if (!publication.registry_revision_id) {
        throw new PipelineProductError(
          `The ${member.inputKey.toUpperCase()} publication has no AX registry revision.`,
          409,
          "registry-revision-mismatch",
        );
      }
      const compatibilityRows = (await tx.execute(sql<{
        selected_revision_is_current_enough: boolean;
        missing_binding_count: number;
      }>`
        select
          selected.revision_number >= origin.revision_number
            as selected_revision_is_current_enough,
          (
            select count(*)::integer
            from private.ax_identity_run_rows as run_row
            where run_row.identity_run_id = ${publication.producer_run_id}::uuid
              and run_row.binding_id is not null
              and not exists (
                select 1
                from private.ax_registry_revision_bindings as revision_binding
                where revision_binding.revision_id = ${input.registryRevisionId}::uuid
                  and revision_binding.binding_id = run_row.binding_id
              )
          ) as missing_binding_count
        from private.ax_registry_revisions as selected
        join private.ax_registry_revisions as origin
          on origin.id = ${publication.registry_revision_id}::uuid
        where selected.id = ${input.registryRevisionId}::uuid
      `)) as unknown as Array<{
        selected_revision_is_current_enough: boolean;
        missing_binding_count: number;
      }>;
      const compatibility = compatibilityRows[0];
      if (!compatibility?.selected_revision_is_current_enough) {
        throw new PipelineProductError(
          `The selected AX registry revision predates the ${member.inputKey.toUpperCase()} publication.`,
          409,
          "registry-revision-too-old",
        );
      }
      if (Number(compatibility.missing_binding_count) > 0) {
        throw new PipelineProductError(
          `The selected AX registry revision no longer contains every ${member.inputKey.toUpperCase()} identity binding.`,
          409,
          "registry-binding-mismatch",
        );
      }
      if (publication.output_checksum !== member.expectedChecksum) {
        throw new PipelineProductError(
          `The ${member.inputKey.toUpperCase()} publication checksum changed before finalization.`,
          409,
          "stale-publication-checksum",
        );
      }
      if (publication.actual_row_count !== publication.row_count) {
        throw new PipelineProductError(
          `The ${member.inputKey.toUpperCase()} publication row archive is incomplete.`,
          409,
          "incomplete-publication-archive",
        );
      }
    }

    const canonicalChecksum = checksumProductValue({
      releaseKey: input.releaseKey,
      resourceSetId: input.resourceSetId,
      registryRevisionId: input.registryRevisionId,
      ruleVersion: input.ruleVersion,
      ruleChecksum: input.ruleChecksum,
      members: orderedMembers.map((member) => ({
        inputKey: member.inputKey,
        publicationId: member.publicationId,
        outputChecksum: byId.get(member.publicationId)!.output_checksum,
        rowCount: byId.get(member.publicationId)!.row_count,
      })),
    });
    const existing = (await tx.execute(sql<ReleaseRow>`
      select * from private.pipeline_release_sets
      where canonical_checksum = ${canonicalChecksum}
        and status in ('draft', 'finalized')
      order by case status when 'finalized' then 0 else 1 end, created_at
      limit 1
      for share
    `)) as unknown as ReleaseRow[];
    if (existing[0]) return mapRelease(existing[0]);

    const created = (await tx.execute(sql<ReleaseRow>`
      insert into private.pipeline_release_sets (
        release_key, resource_set_id, registry_revision_id, rule_version, rule_checksum,
        rule_payload, canonical_checksum, created_by_owner_id, created_by_email
      ) values (
        ${input.releaseKey}, ${input.resourceSetId}::uuid, ${input.registryRevisionId}::uuid,
        ${input.ruleVersion}, ${input.ruleChecksum}, ${JSON.stringify(input.priorities)}::jsonb,
        ${canonicalChecksum}, ${input.actorOwnerId}, ${input.actorEmail}
      ) returning *
    `)) as unknown as ReleaseRow[];
    const release = created[0];
    for (const [position, member] of orderedMembers.entries()) {
      const publication = byId.get(member.publicationId)!;
      await tx.execute(sql`
        insert into private.pipeline_release_members (
          release_set_id, position, input_key, publication_id, publication_checksum,
          publication_row_count, registry_revision_id
        ) values (
          ${release.id}::uuid, ${position}, ${member.inputKey}, ${member.publicationId}::uuid,
          ${publication.output_checksum}, ${publication.row_count}, ${input.registryRevisionId}::uuid
        )
      `);
    }
    return mapRelease(release);
  });
}

export async function finalizePipelineReleaseSetCandidate(
  input: DecidePipelineReleaseCandidateInput,
) {
  validateReleaseCandidateDecision(input, "finalization");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`pipeline-release-candidate:${input.releaseSetId}`}, 0)
      )
    `);
    const retained = (await tx.execute(sql<ReleaseRow>`
      select * from private.pipeline_release_sets
      where id = ${input.releaseSetId}::uuid
      limit 1
      for update
    `)) as unknown as ReleaseRow[];
    const candidate = retained[0];
    if (!candidate) {
      throw new PipelineProductError(
        "The release candidate no longer exists.",
        404,
        "release-candidate-missing",
      );
    }
    if (candidate.status === "finalized") return mapRelease(candidate);
    if (candidate.status !== "draft") {
      throw new PipelineProductError(
        "Only a draft release candidate can be finalized.",
        409,
        "release-candidate-not-reviewable",
      );
    }
    const finalized = (await tx.execute(sql<ReleaseRow>`
      update private.pipeline_release_sets
      set status = 'finalized',
          finalized_by_owner_id = ${input.actorOwnerId}, finalized_by_email = ${input.actorEmail},
          finalization_reason = ${input.reason.trim()}, finalized_at = now()
      where id = ${input.releaseSetId}::uuid and status = 'draft'
      returning *
    `)) as unknown as ReleaseRow[];
    if (!finalized[0]) {
      throw new PipelineProductError("The release could not be finalized atomically.", 409, "release-finalization-failed");
    }
    return mapRelease(finalized[0]);
  });
}

export async function rejectPipelineReleaseSetCandidate(
  input: DecidePipelineReleaseCandidateInput,
) {
  validateReleaseCandidateDecision(input, "rejection");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`pipeline-release-candidate:${input.releaseSetId}`}, 0)
      )
    `);
    const retained = (await tx.execute(sql<ReleaseRow>`
      select * from private.pipeline_release_sets
      where id = ${input.releaseSetId}::uuid
      limit 1
      for update
    `)) as unknown as ReleaseRow[];
    const candidate = retained[0];
    if (!candidate) {
      throw new PipelineProductError(
        "The release candidate no longer exists.",
        404,
        "release-candidate-missing",
      );
    }
    if (candidate.status === "cancelled") return mapRelease(candidate);
    if (candidate.status !== "draft") {
      throw new PipelineProductError(
        "Only a draft release candidate can be rejected.",
        409,
        "release-candidate-not-reviewable",
      );
    }
    const rejected = (await tx.execute(sql<ReleaseRow>`
      update private.pipeline_release_sets
      set status = 'cancelled',
          finalized_by_owner_id = ${input.actorOwnerId},
          finalized_by_email = ${input.actorEmail},
          finalization_reason = ${input.reason.trim()},
          finalized_at = now()
      where id = ${input.releaseSetId}::uuid and status = 'draft'
      returning *
    `)) as unknown as ReleaseRow[];
    if (!rejected[0]) {
      throw new PipelineProductError(
        "The release candidate could not be rejected atomically.",
        409,
        "release-rejection-failed",
      );
    }
    return mapRelease(rejected[0]);
  });
}

export async function finalizePipelineReleaseSet(
  input: FinalizePipelineReleaseInput,
) {
  validateFinalizePipelineReleaseInput(input);
  const candidate = await createPipelineReleaseSetCandidate(input);
  if (candidate.status === "finalized") return candidate;
  return finalizePipelineReleaseSetCandidate({
    releaseSetId: candidate.id,
    actorOwnerId: input.actorOwnerId,
    actorEmail: input.actorEmail,
    reason: input.reason,
  });
}
