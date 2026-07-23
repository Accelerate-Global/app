import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  pipelineReferenceEntries,
  referenceResources,
  referenceResourceSetMembers,
  referenceResourceSets,
  referenceResourceVersions,
} from "@/db/schema";
import type { Tier1PriorityRule } from "@/lib/tier1-products";

import { preparePipelineResource } from "./pipeline-adapters";
import {
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  type PipelineResourceKey,
  type PipelineResourcePayloadByKey,
  type PipelineResourceValidationContext,
  type PreparedPipelineResource,
} from "./pipeline-types";

const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/u;

export type PinnedPipelineResourceRecord = Readonly<{
  resourceSetId: string;
  resourceSetChecksum: string;
  resourceId: string;
  resourceKey: string;
  resourceKind: string;
  versionId: string;
  versionNumber: number;
  schemaVersion: number;
  lifecycleState: string;
  contentChecksum: string | null;
  normalizedResource: unknown;
  entryCount: number;
}>;

export type PinnedPipelineResource<Key extends PipelineResourceKey> = Readonly<{
  binding: Readonly<{
    resourceSetId: string;
    resourceSetChecksum: string;
    resourceId: string;
    resourceKey: Key;
    resourceKind: string;
    versionId: string;
    versionNumber: number;
    schemaVersion: number;
    contentChecksum: string;
  }>;
  resource: PreparedPipelineResource<Key>;
}>;

export class PinnedPipelineResourceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing-resource-set"
      | "resource-set-checksum-mismatch"
      | "missing-resource-binding"
      | "resource-version-mismatch"
      | "resource-checksum-mismatch"
      | "invalid-resource-version"
      | "projection-count-mismatch",
  ) {
    super(message);
    this.name = "PinnedPipelineResourceError";
  }
}

export function validatePinnedPipelineResourceRecord<
  Key extends PipelineResourceKey,
>(input: {
  record: PinnedPipelineResourceRecord | null;
  resourceKey: Key;
  resourceSetId: string;
  resourceSetChecksum: string;
  expectedVersionId?: string;
  expectedContentChecksum?: string;
  validationContext?: PipelineResourceValidationContext;
}): PinnedPipelineResource<Key> {
  const record = input.record;
  if (!record) {
    throw new PinnedPipelineResourceError(
      `Resource set ${input.resourceSetId} does not contain ${input.resourceKey}.`,
      "missing-resource-binding",
    );
  }
  if (record.resourceSetId !== input.resourceSetId) {
    throw new PinnedPipelineResourceError(
      "The loaded resource does not belong to the requested immutable set.",
      "missing-resource-binding",
    );
  }
  if (record.resourceSetChecksum !== input.resourceSetChecksum) {
    throw new PinnedPipelineResourceError(
      "The immutable resource-set checksum does not match the pinned run binding.",
      "resource-set-checksum-mismatch",
    );
  }
  if (record.resourceKey !== input.resourceKey) {
    throw new PinnedPipelineResourceError(
      `The requested ${input.resourceKey} binding resolved to ${record.resourceKey}.`,
      "missing-resource-binding",
    );
  }
  if (
    record.lifecycleState !== "valid" ||
    !record.contentChecksum ||
    !CHECKSUM_PATTERN.test(record.contentChecksum) ||
    record.schemaVersion < 1 ||
    !record.normalizedResource
  ) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} is not a complete valid package.`,
      "invalid-resource-version",
    );
  }
  if (
    input.expectedVersionId &&
    record.versionId !== input.expectedVersionId
  ) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} resolved to a different version ID.`,
      "resource-version-mismatch",
    );
  }
  if (
    input.expectedContentChecksum &&
    record.contentChecksum !== input.expectedContentChecksum
  ) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} resolved to a different checksum.`,
      "resource-checksum-mismatch",
    );
  }
  const resource = preparePipelineResource(
    input.resourceKey,
    record.normalizedResource,
    input.validationContext,
  );
  if (resource.contentChecksum !== record.contentChecksum) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} payload no longer matches its checksum.`,
      "resource-checksum-mismatch",
    );
  }
  if (resource.entryCount !== record.entryCount) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} payload no longer matches its retained row count.`,
      "projection-count-mismatch",
    );
  }
  return {
    binding: {
      resourceSetId: record.resourceSetId,
      resourceSetChecksum: record.resourceSetChecksum,
      resourceId: record.resourceId,
      resourceKey: input.resourceKey,
      resourceKind: record.resourceKind,
      versionId: record.versionId,
      versionNumber: record.versionNumber,
      schemaVersion: record.schemaVersion,
      contentChecksum: record.contentChecksum,
    },
    resource,
  };
}

export async function loadPinnedPipelineReferenceResource<
  Key extends PipelineResourceKey,
>(input: {
  resourceSetId: string;
  resourceSetChecksum: string;
  resourceKey: Key;
  expectedVersionId?: string;
  expectedContentChecksum?: string;
  validationContext?: PipelineResourceValidationContext;
}): Promise<PinnedPipelineResource<Key>> {
  const [set] = await getDb()
    .select({
      id: referenceResourceSets.id,
      checksum: referenceResourceSets.contentChecksum,
    })
    .from(referenceResourceSets)
    .where(eq(referenceResourceSets.id, input.resourceSetId))
    .limit(1);
  if (!set) {
    throw new PinnedPipelineResourceError(
      `Resource set ${input.resourceSetId} was not found.`,
      "missing-resource-set",
    );
  }
  if (set.checksum !== input.resourceSetChecksum) {
    throw new PinnedPipelineResourceError(
      "The immutable resource-set checksum does not match the pinned run binding.",
      "resource-set-checksum-mismatch",
    );
  }
  const [row] = await getDb()
    .select({
      resourceSetId: referenceResourceSetMembers.setId,
      resourceSetChecksum: referenceResourceSets.contentChecksum,
      resourceId: referenceResources.id,
      resourceKey: referenceResources.resourceKey,
      resourceKind: referenceResources.resourceKind,
      versionId: referenceResourceVersions.id,
      versionNumber: referenceResourceVersions.versionNumber,
      schemaVersion: referenceResourceVersions.schemaVersion,
      lifecycleState: referenceResourceVersions.lifecycleState,
      contentChecksum: referenceResourceVersions.contentChecksum,
      normalizedResource: referenceResourceVersions.normalizedResource,
      entryCount: referenceResourceVersions.entryCount,
    })
    .from(referenceResourceSetMembers)
    .innerJoin(
      referenceResourceSets,
      eq(referenceResourceSetMembers.setId, referenceResourceSets.id),
    )
    .innerJoin(
      referenceResources,
      eq(referenceResourceSetMembers.resourceId, referenceResources.id),
    )
    .innerJoin(
      referenceResourceVersions,
      eq(referenceResourceSetMembers.versionId, referenceResourceVersions.id),
    )
    .where(
      and(
        eq(referenceResourceSetMembers.setId, input.resourceSetId),
        eq(referenceResources.resourceKey, input.resourceKey),
      ),
    )
    .limit(1);
  const pinned = validatePinnedPipelineResourceRecord({
    ...input,
    record: row
      ? {
          ...row,
          versionNumber: Number(row.versionNumber),
        }
      : null,
  });
  const [{ projectionCount }] = await getDb()
    .select({ projectionCount: count() })
    .from(pipelineReferenceEntries)
    .where(eq(pipelineReferenceEntries.versionId, pinned.binding.versionId));
  if (projectionCount !== pinned.resource.entryCount) {
    throw new PinnedPipelineResourceError(
      `Pinned resource ${input.resourceKey} typed projections are incomplete.`,
      "projection-count-mismatch",
    );
  }
  return pinned;
}

export async function loadPinnedPipelineReferenceResources<
  Keys extends readonly PipelineResourceKey[],
>(input: {
  resourceSetId: string;
  resourceSetChecksum: string;
  resourceKeys: Keys;
  validationContext?: PipelineResourceValidationContext;
}) {
  const entries = await Promise.all(
    input.resourceKeys.map((resourceKey) =>
      loadPinnedPipelineReferenceResource({
        resourceSetId: input.resourceSetId,
        resourceSetChecksum: input.resourceSetChecksum,
        resourceKey,
        validationContext: input.validationContext,
      }),
    ),
  );
  return new Map(entries.map((entry) => [entry.binding.resourceKey, entry]));
}

export async function loadPinnedTier1PriorityRules(input: {
  resourceSetId: string;
  resourceSetChecksum: string;
  expectedVersionId?: string;
  expectedContentChecksum?: string;
  validationContext?: PipelineResourceValidationContext;
}) {
  const pinned = await loadPinnedPipelineReferenceResource({
    ...input,
    resourceKey: TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  });
  return {
    binding: pinned.binding,
    priorities: pinned.resource.entries
      .filter((entry) => entry.active)
      .map(
        (entry): Tier1PriorityRule => ({
          canonicalField: entry.canonicalField,
          prioritySourceKeys: [...entry.prioritySourceKeys],
        }),
      ),
  };
}

export type PinnedPipelinePayload<Key extends PipelineResourceKey> =
  PipelineResourcePayloadByKey[Key];
