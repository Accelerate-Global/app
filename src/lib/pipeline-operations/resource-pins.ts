import { sql } from "drizzle-orm";

import { getDb } from "@/db";

import { PipelineOperationError } from "./errors";
import type { PipelineJsonObject } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;

export type ExactReferenceVersionBinding = Readonly<{
  resourceKey: string;
  versionId: string;
  checksum: string;
  versionNumber: number;
  schemaVersion: number;
}>;

export type ExactReferenceResourceSnapshot = Readonly<{
  resourceSetId: string;
  resourceSetChecksum: string;
  referenceVersionBindings: Readonly<
    Record<string, ExactReferenceVersionBinding>
  >;
}>;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseExactReferenceResourceSnapshot(
  input: PipelineJsonObject,
): ExactReferenceResourceSnapshot {
  const resourceSetId = input.resourceSetId;
  const resourceSetChecksum = input.resourceSetChecksum;
  if (typeof resourceSetId !== "string" || !UUID_PATTERN.test(resourceSetId)) {
    throw new PipelineOperationError(
      "An exact reference resource-set UUID is required.",
      400,
      "backfill-resource-set-required",
    );
  }
  if (
    typeof resourceSetChecksum !== "string" ||
    !CHECKSUM_PATTERN.test(resourceSetChecksum)
  ) {
    throw new PipelineOperationError(
      "An exact reference resource-set checksum is required.",
      400,
      "backfill-resource-checksum-required",
    );
  }
  const entries = Object.entries(record(input.referenceVersionBindings));
  if (entries.length === 0) {
    throw new PipelineOperationError(
      "Exact reference resource members are required.",
      400,
      "backfill-resource-members-required",
    );
  }
  const referenceVersionBindings = Object.fromEntries(entries.map(
    ([mapKey, value]) => {
      const binding = record(value);
      if (
        typeof binding.resourceKey !== "string" ||
        binding.resourceKey !== mapKey ||
        typeof binding.versionId !== "string" ||
        !UUID_PATTERN.test(binding.versionId) ||
        typeof binding.checksum !== "string" ||
        !CHECKSUM_PATTERN.test(binding.checksum) ||
        !Number.isSafeInteger(binding.versionNumber) ||
        Number(binding.versionNumber) < 1 ||
        !Number.isSafeInteger(binding.schemaVersion) ||
        Number(binding.schemaVersion) < 1
      ) {
        throw new PipelineOperationError(
          `Reference resource binding ${mapKey} is incomplete or malformed.`,
          400,
          "backfill-resource-binding-invalid",
        );
      }
      return [mapKey, {
        resourceKey: binding.resourceKey,
        versionId: binding.versionId,
        checksum: binding.checksum,
        versionNumber: Number(binding.versionNumber),
        schemaVersion: Number(binding.schemaVersion),
      }];
    },
  ));
  return {
    resourceSetId,
    resourceSetChecksum,
    referenceVersionBindings,
  };
}

export async function assertPinnedReferenceResourceSnapshot(
  input: PipelineJsonObject,
) {
  const expected = parseExactReferenceResourceSnapshot(input);
  const rows = (await getDb().execute(sql<{
    resource_set_checksum: string;
    resource_key: string | null;
    version_id: string | null;
    version_checksum: string | null;
    version_number: number | null;
    schema_version: number | null;
  }>`
    select resource_set.content_checksum as resource_set_checksum,
      resource.resource_key, member.version_id,
      version.content_checksum as version_checksum,
      version.version_number, version.schema_version
    from private.reference_resource_sets as resource_set
    left join private.reference_resource_set_members as member
      on member.set_id = resource_set.id
    left join private.reference_resources as resource
      on resource.id = member.resource_id
    left join private.reference_resource_versions as version
      on version.id = member.version_id
    where resource_set.id = ${expected.resourceSetId}::uuid
    order by resource.resource_key
  `)) as unknown as Array<{
    resource_set_checksum: string;
    resource_key: string | null;
    version_id: string | null;
    version_checksum: string | null;
    version_number: number | null;
    schema_version: number | null;
  }>;
  if (!rows[0]) {
    throw new PipelineOperationError(
      "The exact reference resource set no longer exists.",
      409,
      "backfill-resource-set-missing",
    );
  }
  if (rows[0].resource_set_checksum !== expected.resourceSetChecksum) {
    throw new PipelineOperationError(
      "The exact reference resource-set checksum does not match the retained set.",
      409,
      "backfill-resource-checksum-mismatch",
    );
  }
  const retained = rows.flatMap((row) =>
    row.resource_key &&
    row.version_id &&
    row.version_checksum &&
    row.version_number !== null &&
    row.schema_version !== null
      ? [{
          resourceKey: row.resource_key,
          versionId: row.version_id,
          checksum: row.version_checksum,
          versionNumber: Number(row.version_number),
          schemaVersion: Number(row.schema_version),
        }]
      : []
  );
  const supplied = Object.values(expected.referenceVersionBindings);
  if (retained.length !== supplied.length) {
    throw new PipelineOperationError(
      "The exact reference resource members are incomplete or contain unexpected entries.",
      409,
      "backfill-resource-members-mismatch",
    );
  }
  for (const member of retained) {
    const pinned = expected.referenceVersionBindings[member.resourceKey];
    if (
      !pinned ||
      pinned.versionId !== member.versionId ||
      pinned.checksum !== member.checksum ||
      pinned.versionNumber !== member.versionNumber ||
      pinned.schemaVersion !== member.schemaVersion
    ) {
      throw new PipelineOperationError(
        `The exact reference resource binding for ${member.resourceKey} does not match the retained set.`,
        409,
        "backfill-resource-binding-mismatch",
      );
    }
  }
  return expected;
}
