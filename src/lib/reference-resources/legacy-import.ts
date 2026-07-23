import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { parse } from "papaparse";

import {
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  type PipelineResourceKey,
  type PipelineResourcePayloadByKey,
  type PipelineResourceValidationContext,
  type PipelineSemanticType,
} from "./pipeline-types";

export type ExactLegacyResourceFile = Readonly<{
  resourceKey: PipelineResourceKey;
  relativePath: string;
  sha256: string;
  sourceRetrievedAt: string;
}>;

export const EXACT_LEGACY_PIPELINE_RESOURCE_FILES: Readonly<
  Record<PipelineResourceKey, ExactLegacyResourceFile>
> = {
  [SOURCE_ALIASES_RESOURCE_KEY]: {
    resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    relativePath: "resources/Database_Sources/20260330_204117.csv",
    sha256: "1f55e3be68dadd4e99df8837357305f05024833b75b2a06c870ae6b677033f0a",
    sourceRetrievedAt: "2026-03-30T20:41:17.000Z",
  },
  [JP_PEOPLE_ID3_RESOURCE_KEY]: {
    resourceKey: JP_PEOPLE_ID3_RESOURCE_KEY,
    relativePath: "resources/jp/peopleid3/20260330_204114.csv",
    sha256: "eeb4e3f4c7effe3e957334b8590409d9ecbf4303ddc4676750cd78e9a4d5f1f8",
    sourceRetrievedAt: "2026-03-30T20:41:14.000Z",
  },
  [PEID_RESOURCE_KEY]: {
    resourceKey: PEID_RESOURCE_KEY,
    relativePath: "resources/PEID/20260330_204115.csv",
    sha256: "d4faef4315a42e6034c9e8352f4856de6fd589ea2234688f109ec3479a0b9cde",
    sourceRetrievedAt: "2026-03-30T20:41:15.000Z",
  },
  [TIER1_MERGE_PRIORITIES_RESOURCE_KEY]: {
    resourceKey: TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
    relativePath: "resources/data_priority_agg_1/20260330_204115.csv",
    sha256: "d498814f3f5c037b8bcbd65f772142cab5afb1ea3402ace86e384bdac6fea87f",
    sourceRetrievedAt: "2026-03-30T20:41:15.000Z",
  },
  [ENGAGEMENT_MAPPINGS_RESOURCE_KEY]: {
    resourceKey: ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
    relativePath: "resources/engagement_template/20260128_122551.csv",
    sha256: "c3195329a0d7e7d1591abb77190fe2397ddea53f4bc210ba15663c31038d2921",
    sourceRetrievedAt: "2026-01-28T12:25:51.000Z",
  },
};

export class ExactLegacyResourceImportError extends Error {
  constructor(
    message: string,
    readonly code:
      | "checksum-mismatch"
      | "invalid-csv"
      | "missing-column"
      | "invalid-row"
      | "ambiguous-crosswalk"
      | "unknown-source-alias",
  ) {
    super(message);
    this.name = "ExactLegacyResourceImportError";
  }
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: string | undefined) {
  return (value ?? "").normalize("NFKC").trim();
}

function parseBoolean(value: string | undefined) {
  const normalized = normalize(value).toLocaleLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function parseRows(body: string, requiredHeaders: readonly string[]) {
  const normalizedBody = body
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n|\r|\n/gu, "\n");
  const parsed = parse<Record<string, string>>(normalizedBody, {
    header: true,
    newline: "\n",
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const blockingErrors = parsed.errors.filter(
    (error) => error.code !== "TooFewFields",
  );
  if (blockingErrors.length > 0) {
    throw new ExactLegacyResourceImportError(
      `CSV parsing failed: ${blockingErrors[0]!.message}`,
      "invalid-csv",
    );
  }
  const fields = new Set(parsed.meta.fields ?? []);
  const missing = requiredHeaders.filter((header) => !fields.has(header));
  if (missing.length > 0) {
    throw new ExactLegacyResourceImportError(
      `CSV is missing required columns: ${missing.join(", ")}.`,
      "missing-column",
    );
  }
  return parsed.data;
}

function parseSourceAliases(body: string, sourceRetrievedAt: string) {
  const rows = parseRows(body, ["Field ID", "Database Name", "Initials"]);
  return {
    schemaVersion: 1 as const,
    resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    sourceName: "AX Data Database_Sources exact CSV snapshot",
    sourceRetrievedAt,
    entries: rows.flatMap((row) => {
      const fieldId = normalize(row["Field ID"]);
      const displayName = normalize(row["Database Name"]);
      const initials = normalize(row.Initials).toLocaleLowerCase();
      if (!initials) return [];
      if (!fieldId || !displayName) {
        throw new ExactLegacyResourceImportError(
          `Source alias ${fieldId || "(unknown)"} is missing its name or initials.`,
          "invalid-row",
        );
      }
      return [
        {
          fieldId,
          canonicalSourceKey: initials,
          displayName,
          initials,
          aliases: [1, 2, 3, 4]
            .map((index) => normalize(row[`Alt Name ${index}`]))
            .filter(Boolean),
          active: true,
        },
      ];
    }),
  } satisfies PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY];
}

function parseJpPeopleId3(
  body: string,
  sourceRetrievedAt: string,
  validationContext?: PipelineResourceValidationContext,
) {
  const rows = parseRows(body, ["PeopleID3", "ROP3", "ISO3"]);
  const grouped = new Map<string, { rop3: Set<string>; iso3: Set<string> }>();
  for (const row of rows) {
    const peopleId3 = normalize(row.PeopleID3);
    if (!peopleId3) {
      throw new ExactLegacyResourceImportError(
        "JP PeopleID3 contains a row without PeopleID3.",
        "invalid-row",
      );
    }
    const group = grouped.get(peopleId3) ?? {
      rop3: new Set<string>(),
      iso3: new Set<string>(),
    };
    const rop3 = normalize(row.ROP3);
    const iso3 = normalize(row.ISO3).toUpperCase();
    if (rop3) group.rop3.add(rop3);
    if (iso3) group.iso3.add(iso3);
    grouped.set(peopleId3, group);
  }
  return {
    schemaVersion: 1 as const,
    resourceKey: JP_PEOPLE_ID3_RESOURCE_KEY,
    sourceName: "AX Data JP PeopleID3 exact CSV snapshot",
    sourceRetrievedAt,
    entries: [...grouped]
      .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
      .map(([peopleId3, evidence]) => {
        if (evidence.rop3.size > 1) {
          throw new ExactLegacyResourceImportError(
            `PeopleID3 ${peopleId3} maps to conflicting ROP3 values.`,
            "ambiguous-crosswalk",
          );
        }
        const legacyRop3 = [...evidence.rop3][0] ?? null;
        const rop3 =
          legacyRop3 &&
          (!validationContext?.knownRop3Codes ||
            validationContext.knownRop3Codes.has(legacyRop3))
            ? legacyRop3
            : null;
        return {
          peopleId3,
          rop3,
          iso3: evidence.iso3.size === 1 ? [...evidence.iso3][0]! : null,
          active: true,
          parentStatus: rop3 ? ("linked" as const) : ("approved-missing" as const),
          missingParentReason: rop3
            ? null
            : legacyRop3
              ? `The exact legacy JP PeopleID3 snapshot references unavailable ROP3 ${legacyRop3}.`
              : "The exact legacy JP PeopleID3 snapshot publishes no ROP3 parent.",
        };
      }),
  } satisfies PipelineResourcePayloadByKey[typeof JP_PEOPLE_ID3_RESOURCE_KEY];
}

function parsePeid(
  body: string,
  sourceRetrievedAt: string,
  validationContext?: PipelineResourceValidationContext,
) {
  const rows = parseRows(body, [
    "PEID",
    "People Name",
    "ISO3",
    "ROP3",
    "ROP1",
  ]);
  return {
    schemaVersion: 1 as const,
    resourceKey: PEID_RESOURCE_KEY,
    sourceName: "AX Data PEID exact CSV snapshot",
    sourceRetrievedAt,
    entries: rows.map((row) => {
      const peid = normalize(row.PEID);
      const peopleName = normalize(row["People Name"]);
      const legacyRop3 = normalize(row.ROP3) || null;
      const legacyRop1 = normalize(row.ROP1).toUpperCase() || null;
      const rop3 =
        legacyRop3 &&
        (!validationContext?.knownRop3Codes ||
          validationContext.knownRop3Codes.has(legacyRop3))
          ? legacyRop3
          : null;
      const rop1 =
        legacyRop1 &&
        (!validationContext?.knownRop1Codes ||
          validationContext.knownRop1Codes.has(legacyRop1))
          ? legacyRop1
          : null;
      if (!peid || !peopleName) {
        throw new ExactLegacyResourceImportError(
          "PEID contains a row without PEID or People Name.",
          "invalid-row",
        );
      }
      return {
        peid,
        peopleName,
        iso3: normalize(row.ISO3).toUpperCase() || null,
        rop3,
        rop1,
        active: true,
        parentStatus: rop3 ? ("linked" as const) : ("approved-missing" as const),
        missingParentReason: rop3
          ? null
          : legacyRop3
            ? `The exact legacy PEID snapshot references unavailable ROP3 ${legacyRop3}.`
            : "The exact legacy PEID snapshot publishes no ROP3 parent.",
      };
    }),
  } satisfies PipelineResourcePayloadByKey[typeof PEID_RESOURCE_KEY];
}

function sourceAliasIndex(
  sourceAliases: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY],
) {
  const aliases = new Map<string, string>();
  for (const entry of sourceAliases.entries) {
    for (const value of [entry.displayName, entry.initials, ...entry.aliases]) {
      aliases.set(normalize(value).toLocaleLowerCase(), entry.canonicalSourceKey);
    }
  }
  return aliases;
}

function parseTier1Priorities(
  body: string,
  sourceRetrievedAt: string,
  sourceAliases: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY],
) {
  const rows = parseRows(body, [
    "Field ID",
    "Aggregate 1 (internal)",
    "User Interface",
    "Active",
    "Priority #1",
  ]);
  const aliases = sourceAliasIndex(sourceAliases);
  return {
    schemaVersion: 1 as const,
    resourceKey: TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
    sourceName: "AX Data Tier 1 priority exact CSV snapshot",
    sourceRetrievedAt,
    entries: rows.map((row) => {
      const fieldId = normalize(row["Field ID"]);
      const canonicalField = normalize(row["Aggregate 1 (internal)"]);
      if (!fieldId || !canonicalField) {
        throw new ExactLegacyResourceImportError(
          "Tier 1 priority contains a row without Field ID or canonical field.",
          "invalid-row",
        );
      }
      const prioritySourceKeys = [1, 2, 3, 4].flatMap((index) => {
        const value = normalize(row[`Priority #${index}`]);
        if (!value) return [];
        const sourceKey = aliases.get(value.toLocaleLowerCase());
        if (!sourceKey) {
          throw new ExactLegacyResourceImportError(
            `Tier 1 priority ${canonicalField} references unknown source ${value}.`,
            "unknown-source-alias",
          );
        }
        return [sourceKey];
      });
      return {
        fieldId,
        canonicalField,
        displayName: normalize(row["User Interface"]) || canonicalField,
        active: parseBoolean(row.Active),
        prioritySourceKeys: [...new Set(prioritySourceKeys)],
      };
    }),
  } satisfies PipelineResourcePayloadByKey[typeof TIER1_MERGE_PRIORITIES_RESOURCE_KEY];
}

function semanticType(value: string): PipelineSemanticType {
  switch (normalize(value).toLocaleLowerCase()) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "integer":
      return "integer";
    case "double":
      return "double";
    case "timestamp":
      return "date";
    default:
      throw new ExactLegacyResourceImportError(
        `Unsupported engagement data type ${value || "(blank)"}.`,
        "invalid-row",
      );
  }
}

function parseEngagementMappings(body: string, sourceRetrievedAt: string) {
  const rows = parseRows(body, [
    "Field ID",
    "API Fields",
    "Aggregate 2 (internal)",
    "User Interface",
    "Active",
    "Data Type",
  ]);
  return {
    schemaVersion: 1 as const,
    resourceKey: ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
    sourceName: "AX Data engagement_template exact runtime CSV snapshot",
    sourceRetrievedAt,
    entries: rows.flatMap((row) => {
      const canonicalField = normalize(row["Aggregate 2 (internal)"]);
      const fieldId = normalize(row["Field ID"]);
      if (!canonicalField) return [];
      if (!fieldId) {
        throw new ExactLegacyResourceImportError(
          `Engagement mapping ${canonicalField} has no Field ID.`,
          "invalid-row",
        );
      }
      const sourceField = normalize(row["API Fields"]) || canonicalField;
      return [
        {
          fieldId,
          sourceField,
          canonicalField,
          displayName: normalize(row["User Interface"]) || canonicalField,
          active: parseBoolean(row.Active),
          dataType: semanticType(row["Data Type"]),
        },
      ];
    }),
  } satisfies PipelineResourcePayloadByKey[typeof ENGAGEMENT_MAPPINGS_RESOURCE_KEY];
}

export function parseExactLegacyPipelineResource<Key extends PipelineResourceKey>(
  input: {
    resourceKey: Key;
    body: string;
    sourceRetrievedAt: string;
    sourceAliases?: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY];
    validationContext?: PipelineResourceValidationContext;
  },
): PipelineResourcePayloadByKey[Key] {
  switch (input.resourceKey) {
    case SOURCE_ALIASES_RESOURCE_KEY:
      return parseSourceAliases(input.body, input.sourceRetrievedAt) as never;
    case JP_PEOPLE_ID3_RESOURCE_KEY:
      return parseJpPeopleId3(
        input.body,
        input.sourceRetrievedAt,
        input.validationContext,
      ) as never;
    case PEID_RESOURCE_KEY:
      return parsePeid(
        input.body,
        input.sourceRetrievedAt,
        input.validationContext,
      ) as never;
    case TIER1_MERGE_PRIORITIES_RESOURCE_KEY:
      if (!input.sourceAliases) {
        throw new ExactLegacyResourceImportError(
          "Tier 1 priorities require the exact source-alias snapshot.",
          "unknown-source-alias",
        );
      }
      return parseTier1Priorities(
        input.body,
        input.sourceRetrievedAt,
        input.sourceAliases,
      ) as never;
    case ENGAGEMENT_MAPPINGS_RESOURCE_KEY:
      return parseEngagementMappings(input.body, input.sourceRetrievedAt) as never;
  }
}

export async function readExactLegacyPipelineResourceFile(input: {
  axDataRoot: string;
  file: ExactLegacyResourceFile;
}) {
  if (!/^[a-f0-9]{64}$/u.test(input.file.sha256)) {
    throw new ExactLegacyResourceImportError(
      `${input.file.resourceKey} expected checksum is invalid.`,
      "checksum-mismatch",
    );
  }
  const resolvedRoot = path.resolve(input.axDataRoot);
  const absolutePath = path.resolve(resolvedRoot, input.file.relativePath);
  const relative = path.relative(resolvedRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ExactLegacyResourceImportError(
      `${input.file.resourceKey} file must be inside the explicit AX Data root.`,
      "invalid-row",
    );
  }
  const [realRoot, realFile] = await Promise.all([
    realpath(resolvedRoot),
    realpath(absolutePath),
  ]);
  const realRelative = path.relative(realRoot, realFile);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new ExactLegacyResourceImportError(
      `${input.file.resourceKey} file must be inside the explicit AX Data root.`,
      "invalid-row",
    );
  }
  const body = await readFile(realFile);
  const actualChecksum = sha256(body);
  if (actualChecksum !== input.file.sha256) {
    throw new ExactLegacyResourceImportError(
      `${input.file.resourceKey} checksum mismatch: expected ${input.file.sha256}, received ${actualChecksum}.`,
      "checksum-mismatch",
    );
  }
  return {
    body: body.toString("utf8"),
    sourceFileChecksum: actualChecksum,
    relativePath: input.file.relativePath,
  };
}
