import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  referenceResources,
  referenceResourceSetMembers,
  referenceResourceSets,
  referenceResourceVersions,
} from "@/db/schema";
import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";
import type { RopCodeResource } from "@/lib/rop-codes";

import { preparePipelineResource } from "./pipeline-adapters";
import {
  SOURCE_ALIASES_RESOURCE_KEY,
  type PipelineResourcePayloadByKey,
  type PipelineResourceValidationContext,
} from "./pipeline-types";
import { COUNTRY_RESOURCE_KEY, ROP_RESOURCE_KEY } from "./types";

export async function loadPipelineResourceValidationContext(input: {
  resourceSetId: string;
  resourceSetChecksum: string;
  sourceAliases?: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY];
}): Promise<{
  context: PipelineResourceValidationContext;
  lineage: Array<{
    resourceKey: typeof COUNTRY_RESOURCE_KEY | typeof ROP_RESOURCE_KEY;
    versionId: string;
    checksum: string;
  }>;
}> {
  const [set] = await getDb()
    .select()
    .from(referenceResourceSets)
    .where(
      and(
        eq(referenceResourceSets.id, input.resourceSetId),
        eq(referenceResourceSets.contentChecksum, input.resourceSetChecksum),
      ),
    )
    .limit(1);
  if (!set) {
    throw new Error("The validation reference set ID/checksum no longer matches.");
  }
  const rows = await getDb()
    .select({
      resourceKey: referenceResources.resourceKey,
      versionId: referenceResourceVersions.id,
      checksum: referenceResourceVersions.contentChecksum,
      lifecycleState: referenceResourceVersions.lifecycleState,
      normalizedResource: referenceResourceVersions.normalizedResource,
    })
    .from(referenceResourceSetMembers)
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
        inArray(referenceResources.resourceKey, [
          COUNTRY_RESOURCE_KEY,
          ROP_RESOURCE_KEY,
        ]),
      ),
    );
  const country = rows.find((row) => row.resourceKey === COUNTRY_RESOURCE_KEY);
  const rop = rows.find((row) => row.resourceKey === ROP_RESOURCE_KEY);
  if (
    !country?.normalizedResource ||
    !country.checksum ||
    country.lifecycleState !== "valid" ||
    !rop?.normalizedResource ||
    !rop.checksum ||
    rop.lifecycleState !== "valid"
  ) {
    throw new Error(
      "The validation reference set must contain valid Country and ROP packages.",
    );
  }
  const countryPayload = country.normalizedResource as IsoCountryCodeResource;
  const ropPayload = rop.normalizedResource as RopCodeResource;
  const sourceAliases = input.sourceAliases
    ? preparePipelineResource(SOURCE_ALIASES_RESOURCE_KEY, input.sourceAliases)
    : null;
  return {
    context: {
      knownIso3Codes: new Set(
        countryPayload.entries
          .flatMap((entry) =>
            [entry.primaryAlpha3, entry.officialIsoAlpha3, entry.gencAlpha3].filter(
              (value): value is string => Boolean(value),
            ),
          )
          .map((value) => value.toUpperCase()),
      ),
      knownRop3Codes: new Set(Object.keys(ropPayload.rop3DetailsByCode)),
      knownRop1Codes: new Set(Object.keys(ropPayload.rop1DetailsByCode)),
      knownSourceKeys: sourceAliases
        ? new Set(sourceAliases.entries.map((entry) => entry.canonicalSourceKey))
        : undefined,
      activeSourceKeys: sourceAliases
        ? new Set(
            sourceAliases.entries
              .filter((entry) => entry.active)
              .map((entry) => entry.canonicalSourceKey),
          )
        : undefined,
    },
    lineage: [
      {
        resourceKey: COUNTRY_RESOURCE_KEY,
        versionId: country.versionId,
        checksum: country.checksum,
      },
      {
        resourceKey: ROP_RESOURCE_KEY,
        versionId: rop.versionId,
        checksum: rop.checksum,
      },
    ],
  };
}
