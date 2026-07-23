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
  JP_PEOPLE_ID3_RESOURCE_KEY,
} from "@/lib/reference-resources/pipeline-types";
import {
  loadPinnedPipelineReferenceResource,
} from "@/lib/reference-resources/pinned-runtime";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";
import type { SourceJpPeopleId3Reference } from "@/lib/source-forming";

import {
  requireDatasetFormingResourceBindings,
  type DatasetFormingCatalogResource,
} from "./resources";
import { checksumDatasetFormingValue } from "./canonical";
import type {
  DatasetFormingEngineDeclaration,
  DatasetFormingResourceBinding,
} from "./types";

export type DatasetFormingRuntimeResources = {
  resourceSetId: string;
  resourceSetChecksum: string;
  resourceBindings: DatasetFormingResourceBinding[];
  countries: Array<{
    iso3: string;
    displayName: string;
    alternativeNames: string[];
  }>;
  ropEntries: Array<{
    rop1Code: string | null;
    rop2Code: string | null;
    rop25Code: string | null;
    rop3Code: string;
    status: "Active" | "Inactive";
    joinIssue: string | null;
    joinIssueLabel: string | null;
  }>;
  jpPeopleId3Entries?: readonly SourceJpPeopleId3Reference[];
  stableKeyColumn: string | null;
};

export async function loadDatasetFormingRuntimeResources(input: {
  engine: DatasetFormingEngineDeclaration;
  resourceSetId?: string;
  sourceProfileKey?: string;
  stableKeyColumn?: string | null;
}): Promise<DatasetFormingRuntimeResources> {
  const db = getDb();
  const [set] = input.resourceSetId
    ? await db
        .select()
        .from(referenceResourceSets)
        .where(eq(referenceResourceSets.id, input.resourceSetId))
        .limit(1)
    : await db
        .select()
        .from(referenceResourceSets)
        .orderBy(desc(referenceResourceSets.sequenceNumber))
        .limit(1);
  if (!set) throw new Error("No immutable reference resource set is available.");

  const catalogRequirements = input.engine.resourceRequirements.filter(
    (requirement) => requirement.bindingType === "catalog",
  );
  const requiredKeys = catalogRequirements.map((requirement) => requirement.key);
  const members = requiredKeys.length
    ? await db
        .select({
          resourceId: referenceResources.id,
          resourceKey: referenceResources.resourceKey,
          resourceKind: referenceResources.resourceKind,
          versionId: referenceResourceSetMembers.versionId,
          versionNumber: referenceResourceVersions.versionNumber,
          schemaVersion: referenceResourceVersions.schemaVersion,
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
            inArray(referenceResources.resourceKey, requiredKeys),
          ),
        )
    : [];
  const catalogResources = members.map((member) => ({
    key: member.resourceKey,
    kind: member.resourceKind,
    resourceId: member.resourceId,
    versionId: member.versionId,
    version: member.versionNumber,
    schemaVersion: member.schemaVersion,
    checksum: member.contentChecksum,
    lifecycleState: member.lifecycleState,
  })) satisfies DatasetFormingCatalogResource[];
  const resourceBindings = requireDatasetFormingResourceBindings({
    requirements: input.engine.resourceRequirements,
    resourceSet: { id: set.id, checksum: set.contentChecksum },
    catalogResources,
  });
  const stableKeyColumn = input.stableKeyColumn?.trim() || null;
  if (stableKeyColumn) {
    resourceBindings.push({
      position: resourceBindings.length,
      key: `${input.sourceProfileKey ?? "source-profile"}-configuration`,
      bindingType: "code",
      required: true,
      kind: "source-profile-configuration",
      schemaVersion: 1,
      version: stableKeyColumn,
      checksum: checksumDatasetFormingValue({
        schemaVersion: 1,
        sourceProfileKey: input.sourceProfileKey ?? null,
        stableKeyColumn,
      }),
      resourceSetId: null,
      resourceSetChecksum: null,
      resourceId: null,
      resourceVersionId: null,
    });
  }
  const countryVersionId = resourceBindings.find(
    (binding) => binding.key === COUNTRY_RESOURCE_KEY,
  )?.resourceVersionId;
  const ropVersionId = resourceBindings.find(
    (binding) => binding.key === ROP_RESOURCE_KEY,
  )?.resourceVersionId;
  if (!countryVersionId || !ropVersionId) {
    throw new Error("The forming engine requires pinned Country and ROP resources.");
  }
  const jpPeopleId3Binding = resourceBindings.find(
    (binding) => binding.key === JP_PEOPLE_ID3_RESOURCE_KEY,
  );
  if (
    input.engine.resourceRequirements.some(
      (requirement) =>
        requirement.bindingType === "catalog" &&
        requirement.key === JP_PEOPLE_ID3_RESOURCE_KEY &&
        requirement.required,
    ) &&
    !jpPeopleId3Binding
  ) {
    throw new Error(
      "The Joshua Project forming engine requires the pinned PeopleID3 crosswalk.",
    );
  }
  const [countryRows, ropRows, jpPeopleId3Resource] = await Promise.all([
    db
      .select({
        iso3: countryReferenceEntries.primaryAlpha3,
        displayName: countryReferenceEntries.displayName,
        alternativeNames: countryReferenceEntries.alternativeNames,
      })
      .from(countryReferenceEntries)
      .where(
        and(
          eq(countryReferenceEntries.versionId, countryVersionId),
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
      .where(eq(ropReferencePeople.versionId, ropVersionId)),
    jpPeopleId3Binding
      ? loadPinnedPipelineReferenceResource({
          resourceSetId: set.id,
          resourceSetChecksum: set.contentChecksum,
          resourceKey: JP_PEOPLE_ID3_RESOURCE_KEY,
          expectedVersionId: jpPeopleId3Binding.resourceVersionId ?? undefined,
          expectedContentChecksum: jpPeopleId3Binding.checksum,
        })
      : Promise.resolve(null),
  ]);

  return {
    resourceSetId: set.id,
    resourceSetChecksum: set.contentChecksum,
    resourceBindings,
    countries: countryRows
      .filter((row): row is typeof row & { iso3: string } =>
        Boolean(row.iso3?.trim()),
      )
      .map((row) => ({ ...row, iso3: row.iso3 })),
    ropEntries: ropRows
      .filter((row): row is typeof row & { rop3Code: string } =>
        Boolean(row.rop3Code?.trim()),
      )
      .map((row) => ({ ...row, rop3Code: row.rop3Code })),
    ...(jpPeopleId3Resource
      ? { jpPeopleId3Entries: jpPeopleId3Resource.resource.entries }
      : {}),
    stableKeyColumn,
  };
}
