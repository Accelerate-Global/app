import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  countryReferenceEntries,
  referenceResources,
  referenceResourceSetMembers,
  referenceResourceSets,
  referenceResourceVersions,
  ropReferencePeople,
} from "@/db/schema";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";

import type { ImbCountryReference, ImbRopReference } from "./engine";
import type { ImbFormingResourceBinding } from "./types";

export type ImbFormingResources = {
  binding: ImbFormingResourceBinding;
  countries: ImbCountryReference[];
  ropEntries: ImbRopReference[];
};

export async function loadImbFormingResourceBinding(resourceSetId?: string) {
  const db = getDb();
  const [set] = resourceSetId
    ? await db
        .select()
        .from(referenceResourceSets)
        .where(eq(referenceResourceSets.id, resourceSetId))
        .limit(1)
    : await db
        .select()
        .from(referenceResourceSets)
        .orderBy(desc(referenceResourceSets.sequenceNumber))
        .limit(1);

  if (!set) {
    throw new Error("No reference resource set is available for IMB forming.");
  }

  const members = await db
    .select({
      resourceKey: referenceResources.resourceKey,
      versionId: referenceResourceSetMembers.versionId,
      lifecycleState: referenceResourceVersions.lifecycleState,
      contentChecksum: referenceResourceVersions.contentChecksum,
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
        eq(referenceResourceSetMembers.setId, set.id),
        inArray(referenceResources.resourceKey, [
          COUNTRY_RESOURCE_KEY,
          ROP_RESOURCE_KEY,
        ]),
      ),
    );
  const byKey = new Map(members.map((member) => [member.resourceKey, member.versionId]));
  const countryVersionId = byKey.get(COUNTRY_RESOURCE_KEY);
  const ropVersionId = byKey.get(ROP_RESOURCE_KEY);

  if (
    !countryVersionId ||
    !ropVersionId ||
    members.some(
      (member) =>
        member.lifecycleState !== "valid" || !member.contentChecksum?.trim(),
    )
  ) {
    throw new Error("The pinned resource set is missing Country or ROP data.");
  }

  return {
    resourceSetId: set.id,
    resourceSetChecksum: set.contentChecksum,
    countryVersionId,
    ropVersionId,
  } satisfies ImbFormingResourceBinding;
}

export async function loadImbFormingResources(resourceSetId?: string) {
  const binding = await loadImbFormingResourceBinding(resourceSetId);
  const db = getDb();
  const [countryRows, ropRows] = await Promise.all([
    db
      .select({
        iso3: countryReferenceEntries.primaryAlpha3,
        displayName: countryReferenceEntries.displayName,
        alternativeNames: countryReferenceEntries.alternativeNames,
      })
      .from(countryReferenceEntries)
      .where(
        and(
          eq(countryReferenceEntries.versionId, binding.countryVersionId),
          eq(countryReferenceEntries.active, true),
        ),
      ),
    db
      .select({
        rop1Code: ropReferencePeople.rop1Code,
        rop2Code: ropReferencePeople.rop2Code,
        rop25Code: ropReferencePeople.rop25Code,
        rop3Code: ropReferencePeople.rop3Code,
        status: ropReferencePeople.status,
        joinIssue: ropReferencePeople.joinIssue,
        joinIssueLabel: ropReferencePeople.joinIssueLabel,
      })
      .from(ropReferencePeople)
      .where(eq(ropReferencePeople.versionId, binding.ropVersionId)),
  ]);

  const countries = countryRows
    .filter((row): row is typeof row & { iso3: string } => Boolean(row.iso3?.trim()))
    .map((row) => ({
      iso3: row.iso3,
      displayName: row.displayName,
      alternativeNames: row.alternativeNames,
    }));
  const ropEntries = ropRows
    .filter((row): row is typeof row & { rop3Code: string } => Boolean(row.rop3Code?.trim()))
    .map((row) => ({ ...row, rop3Code: row.rop3Code }));

  return {
    binding,
    countries,
    ropEntries,
  } satisfies ImbFormingResources;
}
