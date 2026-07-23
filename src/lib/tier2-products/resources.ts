import type { Tier2PartnerResources } from "./types";

export type Tier2ResourceIssue = Readonly<{
  code: string;
  resourceKey: string;
  entryKey: string | null;
  message: string;
}>;

function duplicateValues<T>(
  rows: readonly T[],
  valueFor: (row: T) => string,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = valueFor(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

export function validateTier2PartnerResources(
  resources: Tier2PartnerResources,
): Tier2ResourceIssue[] {
  const issues: Tier2ResourceIssue[] = [];
  const add = (
    code: string,
    resourceKey: string,
    entryKey: string | null,
    message: string,
  ) => issues.push({ code, resourceKey, entryKey, message });

  const checksums = Object.entries(resources.lineage).filter(([key]) =>
    key.endsWith("Checksum"),
  );
  for (const [key, checksum] of checksums) {
    if (!/^[a-f0-9]{64}$/u.test(checksum)) {
      add(
        "invalid-resource-checksum",
        key.replace(/Checksum$/u, ""),
        null,
        `${key} must be a lowercase SHA-256 checksum.`,
      );
    }
  }

  if (!resources.engagementMappings.some((entry) => entry.active)) {
    add(
      "missing-active-engagement-mapping",
      "engagement-mappings",
      null,
      "At least one engagement mapping must be active.",
    );
  }

  if (!resources.sourceAliases.some((entry) => entry.active)) {
    add(
      "missing-active-source-alias",
      "source-aliases",
      null,
      "At least one source alias must be active.",
    );
  }

  for (const canonicalField of duplicateValues(
    resources.engagementMappings.filter((entry) => entry.active),
    (entry) => entry.canonicalField,
  )) {
    add(
      "duplicate-engagement-target",
      "engagement-mappings",
      canonicalField,
      `Canonical engagement field ${canonicalField} is mapped more than once.`,
    );
  }

  for (const sourceField of duplicateValues(
    resources.engagementMappings.filter((entry) => entry.active),
    (entry) => entry.sourceField.normalize("NFKC").trim().toLowerCase(),
  )) {
    add(
      "duplicate-engagement-source",
      "engagement-mappings",
      sourceField,
      `Source field ${sourceField} is mapped more than once.`,
    );
  }

  const rop3Codes = new Set(
    resources.ropEntries.map((entry) => entry.rop3Code.trim()),
  );
  const iso3Codes = new Set(
    resources.countries.map((entry) => entry.iso3.trim().toUpperCase()),
  );

  for (const entry of resources.peopleId3Entries.filter((item) => item.active)) {
    if (entry.parentStatus === "linked" && (!entry.rop3 || !rop3Codes.has(entry.rop3))) {
      add(
        "invalid-peopleid3-rop3-reference",
        "jp-peopleid3",
        entry.peopleId3,
        `PeopleID3 ${entry.peopleId3} does not resolve to one pinned ROP3.`,
      );
    }
    if (entry.iso3 && !iso3Codes.has(entry.iso3.toUpperCase())) {
      add(
        "invalid-peopleid3-iso3-reference",
        "jp-peopleid3",
        entry.peopleId3,
        `PeopleID3 ${entry.peopleId3} references unknown ISO3 ${entry.iso3}.`,
      );
    }
  }

  for (const entry of resources.peidEntries.filter((item) => item.active)) {
    if (entry.parentStatus === "linked" && (!entry.rop3 || !rop3Codes.has(entry.rop3))) {
      add(
        "invalid-peid-rop3-reference",
        "peid",
        entry.peid,
        `PEID ${entry.peid} does not resolve to one pinned ROP3.`,
      );
    }
    if (entry.iso3 && !iso3Codes.has(entry.iso3.toUpperCase())) {
      add(
        "invalid-peid-iso3-reference",
        "peid",
        entry.peid,
        `PEID ${entry.peid} references unknown ISO3 ${entry.iso3}.`,
      );
    }
  }

  for (const duplicate of duplicateValues(
    resources.peopleId3Entries.filter((entry) => entry.active),
    (entry) => entry.peopleId3,
  )) {
    add(
      "ambiguous-peopleid3",
      "jp-peopleid3",
      duplicate,
      `PeopleID3 ${duplicate} has more than one active crosswalk row.`,
    );
  }
  for (const duplicate of duplicateValues(
    resources.peidEntries.filter((entry) => entry.active),
    (entry) => entry.peid,
  )) {
    add(
      "ambiguous-peid",
      "peid",
      duplicate,
      `PEID ${duplicate} has more than one active crosswalk row.`,
    );
  }

  return issues;
}

export function resolveTier2PartnerSourceAlias(input: {
  partnerKey: string;
  resources: Tier2PartnerResources;
}) {
  const matches = input.resources.sourceAliases.filter(
    (entry) =>
      entry.active &&
      entry.canonicalSourceKey === input.partnerKey,
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Partner key ${input.partnerKey} has no active pinned source-alias entry.`
        : `Partner key ${input.partnerKey} has multiple active pinned source-alias entries.`,
    );
  }
  return matches[0]!;
}
