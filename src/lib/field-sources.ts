import { readFile } from "node:fs/promises";
import path from "node:path";

import Papa from "papaparse";
import { asc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  fieldDefinitions,
  fieldDefinitionSources,
  fieldSourceTypes,
} from "@/db/schema";
import type {
  FieldDefinitionLinkedSource,
  FieldSourceGridRow,
  FieldSourceType,
} from "@/lib/api-types";
import { normalizeHeaderIdentity } from "@/lib/csv";
import { getFieldDefinitionCanonicalKeyFromLabel } from "@/lib/field-definition-canonical";
import { getFieldDefinitionEffectiveLabel } from "@/lib/field-definition-presentation";

const FIELD_SOURCE_MAPPING_CSV_PATH = path.join(
  process.cwd(),
  "src/data/field-sources/aggregate-1-field-mapping.csv",
);
const FIELD_DESCRIPTION_CSV_PATH = path.join(
  process.cwd(),
  "src/data/field-sources/field-description-seed.csv",
);

const CSV_FIELD_SOURCE_TYPE_LABELS = [
  "Joshua Project",
  "IMB (People Groups)",
  "Etnopedia",
  "Accelerate",
  "Add-on Fields",
] as const;
const DEFAULT_FIELD_SOURCE_TYPE_LABELS = [
  "Joshua Project",
  "IMB (People Groups)",
  "Etnopedia",
  "Accelerate",
] as const;

const PRIORITY_CODE_TO_SOURCE_LABEL = {
  JP: "Joshua Project",
  IMB: "IMB (People Groups)",
  AX: "Accelerate",
  ETNO: "Etnopedia",
} as const;

type CsvPriorityColumn =
  | "Priority #1"
  | "Priority #2"
  | "Priority #3"
  | "Priority #4";

type FieldSourceMappingCsvRow = {
  "Field ID"?: string;
  "Joshua Project"?: string;
  "IMB (People Groups)"?: string;
  Etnopedia?: string;
  Accelerate?: string;
  "Add-on Fields"?: string;
  "Aggregate 1 (internal)"?: string;
  "User Interface"?: string;
  Active?: string;
  "Data Type"?: string;
  "Priority #1"?: string;
  "Priority #2"?: string;
  "Priority #3"?: string;
  "Priority #4"?: string;
};

type FieldDescriptionCsvRow = {
  "Field ID"?: string;
  "User Interface"?: string;
  Description?: string;
  Active?: string;
  "Data Type"?: string;
};

type FieldSourceSeedRow = {
  canonicalKey: string;
  label: string;
  displayLabel: string;
  definition: string;
  mappingFieldId: string | null;
  mappingDataType: string | null;
  mappingIsActive: boolean | null;
  sourcePriorityKeys: string[];
  sourceValues: Array<{
    sourceKey: string;
    sourceFieldName: string;
  }>;
};

type FieldDefinitionSourceJoinRow = {
  fieldDefinitionId: string;
  sourceId: string;
  sourceKey: string;
  sourceLabel: string;
  sourceSortOrder: number;
  sourceFieldName: string;
};

export class FieldSourceTypeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldSourceTypeConflictError";
  }
}

function normalizeSourceFieldName(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeFieldDescription(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeFieldDisplayLabel(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function mergeSeededFieldDisplayLabel(input: {
  existingDisplayLabel?: string | null;
  seededDisplayLabel?: string | null;
}) {
  const existingDisplayLabel = normalizeFieldDisplayLabel(
    input.existingDisplayLabel,
  );

  if (existingDisplayLabel) {
    return existingDisplayLabel;
  }

  return normalizeFieldDisplayLabel(input.seededDisplayLabel);
}

function normalizeFieldId(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeFieldSourceTypeLabel(label: string) {
  return label.trim();
}

function normalizeSeedSourceLabel(label: string) {
  return label === "Add-on Fields" ? "Accelerate" : label;
}

function normalizePriorityCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function parseMappingIsActive(value: string | null | undefined) {
  const normalizedValue = (value ?? "").trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return null;
}

function getPriorityColumnSourceKey(value: string | null | undefined) {
  const normalizedCode = normalizePriorityCode(value);

  if (!normalizedCode) {
    return null;
  }

  const sourceLabel =
    PRIORITY_CODE_TO_SOURCE_LABEL[
      normalizedCode as keyof typeof PRIORITY_CODE_TO_SOURCE_LABEL
    ];

  if (!sourceLabel) {
    return null;
  }

  return getFieldSourceTypeKey(sourceLabel);
}

function getFieldSourcePriorityKeys(row: FieldSourceMappingCsvRow) {
  const priorityColumns: CsvPriorityColumn[] = [
    "Priority #1",
    "Priority #2",
    "Priority #3",
    "Priority #4",
  ];
  const seen = new Set<string>();

  return priorityColumns.flatMap((column) => {
    const sourceKey = getPriorityColumnSourceKey(row[column]);

    if (!sourceKey || seen.has(sourceKey)) {
      return [];
    }

    seen.add(sourceKey);
    return [sourceKey];
  });
}

function sortLinkedSources(
  linkedSources: Array<
    FieldDefinitionLinkedSource & {
      sortOrder: number;
    }
  >,
  sourcePriorityKeys: string[],
) {
  const priorityRankByKey = new Map(
    sourcePriorityKeys.map((sourceKey, index) => [sourceKey, index]),
  );

  return [...linkedSources]
    .sort((left, right) => {
      const leftPriorityRank = priorityRankByKey.get(left.key);
      const rightPriorityRank = priorityRankByKey.get(right.key);

      if (leftPriorityRank !== undefined || rightPriorityRank !== undefined) {
        if (leftPriorityRank === undefined) {
          return 1;
        }

        if (rightPriorityRank === undefined) {
          return -1;
        }

        if (leftPriorityRank !== rightPriorityRank) {
          return leftPriorityRank - rightPriorityRank;
        }
      }

      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label, undefined, {
        sensitivity: "base",
      });
    })
    .map((linkedSource) => ({
      id: linkedSource.id,
      key: linkedSource.key,
      label: linkedSource.label,
    }));
}

function toFieldSourceType(
  row: typeof fieldSourceTypes.$inferSelect,
): FieldSourceType {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFieldSourceGridRow(input: {
  row: typeof fieldDefinitions.$inferSelect;
  linkedSources: FieldDefinitionLinkedSource[];
  sourceValues: Record<string, string>;
}): FieldSourceGridRow {
  return {
    fieldDefinitionId: input.row.id,
    canonicalKey: input.row.canonicalKey,
    label: input.row.label,
    displayLabel: input.row.displayLabel,
    effectiveLabel: getFieldDefinitionEffectiveLabel(input.row),
    definition: input.row.definition,
    mappingFieldId: input.row.mappingFieldId,
    mappingDataType: input.row.mappingDataType,
    mappingIsActive: input.row.mappingIsActive,
    sourcePriorityKeys: input.row.sourcePriorityKeys,
    sourceValues: input.sourceValues,
    linkedSources: input.linkedSources,
    createdAt: input.row.createdAt.toISOString(),
    updatedAt: input.row.updatedAt.toISOString(),
  };
}

async function readFieldSourceSeedCsvFile() {
  return readFile(FIELD_SOURCE_MAPPING_CSV_PATH, "utf8");
}

async function readFieldDescriptionSeedCsvFile() {
  return readFile(FIELD_DESCRIPTION_CSV_PATH, "utf8");
}

export function getFieldSourceTypeKey(label: string) {
  return normalizeHeaderIdentity(normalizeFieldSourceTypeLabel(label), 0);
}

export function parseFieldDescriptionCsv(content: string) {
  const parsed = Papa.parse<FieldDescriptionCsvRow>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Field description CSV is invalid.");
  }

  const descriptionsByFieldId = new Map<string, string>();

  for (const row of parsed.data) {
    const fieldId = normalizeFieldId(row["Field ID"]);
    const description = normalizeFieldDescription(row.Description);

    if (!fieldId || !description) {
      continue;
    }

    descriptionsByFieldId.set(fieldId, description);
  }

  return descriptionsByFieldId;
}

export function parseFieldSourceMappingCsv(
  content: string,
  descriptionsByFieldId = new Map<string, string>(),
): FieldSourceSeedRow[] {
  const parsed = Papa.parse<FieldSourceMappingCsvRow>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Field source mapping CSV is invalid.");
  }

  return parsed.data.flatMap((row) => {
    const label = normalizeSourceFieldName(row["Aggregate 1 (internal)"]);

    if (!label) {
      return [];
    }

    const seenSourceKeys = new Set<string>();
    const sourceValues = CSV_FIELD_SOURCE_TYPE_LABELS.flatMap((sourceLabel) => {
      const sourceFieldName = normalizeSourceFieldName(row[sourceLabel]);

      if (!sourceFieldName) {
        return [];
      }

      const sourceKey = getFieldSourceTypeKey(
        normalizeSeedSourceLabel(sourceLabel),
      );

      if (seenSourceKeys.has(sourceKey)) {
        return [];
      }

      seenSourceKeys.add(sourceKey);

      return [
        {
          sourceKey,
          sourceFieldName,
        },
      ];
    });

    return [
      {
        canonicalKey: getFieldDefinitionCanonicalKeyFromLabel(label, 0),
        label,
        displayLabel: normalizeFieldDisplayLabel(row["User Interface"]),
        definition: descriptionsByFieldId.get(
          normalizeFieldId(row["Field ID"]),
        ) ?? "",
        mappingFieldId: normalizeSourceFieldName(row["Field ID"]) || null,
        mappingDataType: normalizeSourceFieldName(row["Data Type"]) || null,
        mappingIsActive: parseMappingIsActive(row.Active),
        sourcePriorityKeys: getFieldSourcePriorityKeys(row),
        sourceValues,
      } satisfies FieldSourceSeedRow,
    ];
  });
}

async function loadFieldSourceSeedRows() {
  const [mappingContent, descriptionContent] = await Promise.all([
    readFieldSourceSeedCsvFile(),
    readFieldDescriptionSeedCsvFile(),
  ]);

  return parseFieldSourceMappingCsv(
    mappingContent,
    parseFieldDescriptionCsv(descriptionContent),
  );
}

function buildLinkedSourceMaps(input: {
  rows: Array<{
    id: string;
    sourcePriorityKeys: string[];
  }>;
  joinedSourceRows: FieldDefinitionSourceJoinRow[];
}) {
  const priorityKeysByFieldDefinitionId = new Map(
    input.rows.map((row) => [row.id, row.sourcePriorityKeys]),
  );
  const linkedSourceRowsByFieldDefinitionId = new Map<
    string,
    Array<
      FieldDefinitionLinkedSource & {
        sortOrder: number;
      }
    >
  >();
  const sourceValuesByFieldDefinitionId = new Map<string, Record<string, string>>();

  for (const joinedSourceRow of input.joinedSourceRows) {
    const linkedSources =
      linkedSourceRowsByFieldDefinitionId.get(joinedSourceRow.fieldDefinitionId) ?? [];
    linkedSources.push({
      id: joinedSourceRow.sourceId,
      key: joinedSourceRow.sourceKey,
      label: joinedSourceRow.sourceLabel,
      sortOrder: joinedSourceRow.sourceSortOrder,
    });
    linkedSourceRowsByFieldDefinitionId.set(joinedSourceRow.fieldDefinitionId, linkedSources);

    const sourceValues =
      sourceValuesByFieldDefinitionId.get(joinedSourceRow.fieldDefinitionId) ?? {};
    sourceValues[joinedSourceRow.sourceId] = joinedSourceRow.sourceFieldName;
    sourceValuesByFieldDefinitionId.set(joinedSourceRow.fieldDefinitionId, sourceValues);
  }

  const linkedSourcesByFieldDefinitionId = new Map<string, FieldDefinitionLinkedSource[]>();

  for (const row of input.rows) {
    linkedSourcesByFieldDefinitionId.set(
      row.id,
      sortLinkedSources(
        linkedSourceRowsByFieldDefinitionId.get(row.id) ?? [],
        priorityKeysByFieldDefinitionId.get(row.id) ?? [],
      ),
    );
  }

  return {
    linkedSourcesByFieldDefinitionId,
    sourceValuesByFieldDefinitionId,
  };
}

async function listFieldDefinitionSourceJoinRows(fieldDefinitionIds?: string[]) {
  const query = getDb()
    .select({
      fieldDefinitionId: fieldDefinitionSources.fieldDefinitionId,
      sourceId: fieldSourceTypes.id,
      sourceKey: fieldSourceTypes.key,
      sourceLabel: fieldSourceTypes.label,
      sourceSortOrder: fieldSourceTypes.sortOrder,
      sourceFieldName: fieldDefinitionSources.sourceFieldName,
    })
    .from(fieldDefinitionSources)
    .innerJoin(
      fieldSourceTypes,
      eq(fieldDefinitionSources.sourceTypeId, fieldSourceTypes.id),
    )
    .orderBy(asc(fieldSourceTypes.sortOrder), asc(fieldSourceTypes.label));

  if (!fieldDefinitionIds || fieldDefinitionIds.length === 0) {
    return query;
  }

  return query.where(inArray(fieldDefinitionSources.fieldDefinitionId, fieldDefinitionIds));
}

async function findExistingFieldSourceTypeByLabelOrKey(input: {
  label: string;
  key: string;
}) {
  const [fieldSourceType] = await getDb()
    .select({
      id: fieldSourceTypes.id,
      key: fieldSourceTypes.key,
      label: fieldSourceTypes.label,
    })
    .from(fieldSourceTypes)
    .where(
      sql`lower(btrim(${fieldSourceTypes.label})) = lower(${input.label}) or ${fieldSourceTypes.key} = ${input.key}`,
    )
    .limit(1);

  return fieldSourceType ?? null;
}

async function findFieldSourceTypeById(sourceTypeId: string) {
  const [fieldSourceType] = await getDb()
    .select()
    .from(fieldSourceTypes)
    .where(eq(fieldSourceTypes.id, sourceTypeId))
    .limit(1);

  return fieldSourceType ?? null;
}

async function listFieldDefinitionRows() {
  return getDb()
    .select()
    .from(fieldDefinitions)
    .orderBy(asc(fieldDefinitions.label), asc(fieldDefinitions.createdAt));
}

async function listFieldSourceTypeRows() {
  return getDb()
    .select()
    .from(fieldSourceTypes)
    .orderBy(asc(fieldSourceTypes.sortOrder), asc(fieldSourceTypes.label));
}

export async function seedFieldSourceRegistryIfNeeded() {
  const seedRows = await loadFieldSourceSeedRows();
  const addOnFieldsSourceKey = getFieldSourceTypeKey("Add-on Fields");

  if (seedRows.length === 0) {
    return { seeded: false };
  }

  await getDb().transaction(async (tx) => {
    const existingFieldDefinitionRows = await tx
      .select({
        canonicalKey: fieldDefinitions.canonicalKey,
        displayLabel: fieldDefinitions.displayLabel,
      })
      .from(fieldDefinitions)
      .where(
        inArray(
          fieldDefinitions.canonicalKey,
          seedRows.map((row) => row.canonicalKey),
        ),
      );
    const existingDisplayLabelByCanonicalKey = new Map(
      existingFieldDefinitionRows.map((row) => [
        row.canonicalKey,
        row.displayLabel,
      ]),
    );
    const mergedSeedRows = seedRows.map((row) => ({
      ...row,
      displayLabel: mergeSeededFieldDisplayLabel({
        existingDisplayLabel: existingDisplayLabelByCanonicalKey.get(
          row.canonicalKey,
        ),
        seededDisplayLabel: row.displayLabel,
      }),
    }));

    await tx
      .insert(fieldSourceTypes)
      .values(
        DEFAULT_FIELD_SOURCE_TYPE_LABELS.map((label, index) => ({
          key: getFieldSourceTypeKey(label),
          label,
          sortOrder: index + 1,
        })),
      )
      .onConflictDoUpdate({
        target: fieldSourceTypes.key,
        set: {
          label: sql`excluded.label`,
          sortOrder: sql`excluded.sort_order`,
        },
      });

    await tx
      .insert(fieldDefinitions)
      .values(
        mergedSeedRows.map((row) => ({
          canonicalKey: row.canonicalKey,
          label: row.label,
          displayLabel: row.displayLabel,
          definition: row.definition,
          mappingFieldId: row.mappingFieldId,
          mappingDataType: row.mappingDataType,
          mappingIsActive: row.mappingIsActive,
          sourcePriorityKeys: row.sourcePriorityKeys,
        })),
      )
      .onConflictDoUpdate({
        target: fieldDefinitions.canonicalKey,
        set: {
          displayLabel: sql`excluded.display_label`,
          definition: sql`case
            when btrim(coalesce(${fieldDefinitions.definition}, '')) = ''
              and btrim(coalesce(excluded.definition, '')) <> ''
            then excluded.definition
            else ${fieldDefinitions.definition}
          end`,
          mappingFieldId: sql`excluded.mapping_field_id`,
          mappingDataType: sql`excluded.mapping_data_type`,
          mappingIsActive: sql`excluded.mapping_is_active`,
          sourcePriorityKeys: sql`excluded.source_priority_keys`,
        },
      });

    const sourceTypeRows = await tx
      .select({
        id: fieldSourceTypes.id,
        key: fieldSourceTypes.key,
      })
      .from(fieldSourceTypes)
      .where(
        inArray(
          fieldSourceTypes.key,
          DEFAULT_FIELD_SOURCE_TYPE_LABELS.map((label) =>
            getFieldSourceTypeKey(label),
          ),
        ),
      );
    const fieldDefinitionRows = await tx
      .select({
        id: fieldDefinitions.id,
        canonicalKey: fieldDefinitions.canonicalKey,
      })
      .from(fieldDefinitions)
      .where(
        inArray(
          fieldDefinitions.canonicalKey,
          mergedSeedRows.map((row) => row.canonicalKey),
        ),
      );
    const sourceTypeIdByKey = new Map(
      sourceTypeRows.map((row) => [row.key, row.id]),
    );
    const fieldDefinitionIdByCanonicalKey = new Map(
      fieldDefinitionRows.map((row) => [row.canonicalKey, row.id]),
    );
    const matchedFieldDefinitionIds = fieldDefinitionRows.map((row) => row.id);
    const fieldDefinitionSourceRows = mergedSeedRows.flatMap((row) =>
      row.sourceValues.flatMap((sourceValue) => {
        const fieldDefinitionId = fieldDefinitionIdByCanonicalKey.get(row.canonicalKey);
        const sourceTypeId = sourceTypeIdByKey.get(sourceValue.sourceKey);

        if (!fieldDefinitionId || !sourceTypeId) {
          return [];
        }

        return [
          {
            fieldDefinitionId,
            sourceTypeId,
            sourceFieldName: sourceValue.sourceFieldName,
          },
        ];
      }),
    );

    if (matchedFieldDefinitionIds.length > 0) {
      await tx
        .delete(fieldDefinitionSources)
        .where(inArray(fieldDefinitionSources.fieldDefinitionId, matchedFieldDefinitionIds));
    }

    if (fieldDefinitionSourceRows.length > 0) {
      await tx
        .insert(fieldDefinitionSources)
        .values(fieldDefinitionSourceRows)
        .onConflictDoNothing({
          target: [
            fieldDefinitionSources.fieldDefinitionId,
            fieldDefinitionSources.sourceTypeId,
          ],
        });
    }

    const [addOnFieldsSourceType] = await tx
      .select({ id: fieldSourceTypes.id })
      .from(fieldSourceTypes)
      .where(eq(fieldSourceTypes.key, addOnFieldsSourceKey));

    if (!addOnFieldsSourceType) {
      return;
    }

    const remainingAddOnFieldsSources = await tx
      .select({ id: fieldDefinitionSources.id })
      .from(fieldDefinitionSources)
      .where(eq(fieldDefinitionSources.sourceTypeId, addOnFieldsSourceType.id));

    if (remainingAddOnFieldsSources.length === 0) {
      await tx
        .delete(fieldSourceTypes)
        .where(eq(fieldSourceTypes.id, addOnFieldsSourceType.id));
    }
  });
  return { seeded: true };
}

export async function listLinkedSourcesByFieldDefinitionId(
  rows: Array<{
    id: string;
    sourcePriorityKeys: string[];
  }>,
) {
  if (rows.length === 0) {
    return new Map<string, FieldDefinitionLinkedSource[]>();
  }

  const joinedSourceRows = await listFieldDefinitionSourceJoinRows(
    rows.map((row) => row.id),
  );

  return buildLinkedSourceMaps({
    rows,
    joinedSourceRows,
  }).linkedSourcesByFieldDefinitionId;
}

export async function listFieldSourceGridData() {
  const [fieldDefinitionRows, fieldSourceTypeRows, joinedSourceRows] = await Promise.all([
    listFieldDefinitionRows(),
    listFieldSourceTypeRows(),
    listFieldDefinitionSourceJoinRows(),
  ]);
  const {
    linkedSourcesByFieldDefinitionId,
    sourceValuesByFieldDefinitionId,
  } = buildLinkedSourceMaps({
    rows: fieldDefinitionRows.map((row) => ({
      id: row.id,
      sourcePriorityKeys: row.sourcePriorityKeys,
    })),
    joinedSourceRows,
  });

  return {
    fieldSourceTypes: fieldSourceTypeRows.map(toFieldSourceType),
    fieldSources: [...fieldDefinitionRows]
      .sort((left, right) =>
        getFieldDefinitionEffectiveLabel(left).localeCompare(
          getFieldDefinitionEffectiveLabel(right),
          undefined,
          { sensitivity: "base" },
        ),
      )
      .map((row) =>
        toFieldSourceGridRow({
          row,
          linkedSources: linkedSourcesByFieldDefinitionId.get(row.id) ?? [],
          sourceValues: sourceValuesByFieldDefinitionId.get(row.id) ?? {},
        }),
      ),
  };
}

export async function getFieldSourceGridRow(fieldDefinitionId: string) {
  const [fieldDefinitionRow] = await getDb()
    .select()
    .from(fieldDefinitions)
    .where(eq(fieldDefinitions.id, fieldDefinitionId))
    .limit(1);

  if (!fieldDefinitionRow) {
    return null;
  }

  const joinedSourceRows = await listFieldDefinitionSourceJoinRows([fieldDefinitionId]);
  const {
    linkedSourcesByFieldDefinitionId,
    sourceValuesByFieldDefinitionId,
  } = buildLinkedSourceMaps({
    rows: [
      {
        id: fieldDefinitionRow.id,
        sourcePriorityKeys: fieldDefinitionRow.sourcePriorityKeys,
      },
    ],
    joinedSourceRows,
  });

  return toFieldSourceGridRow({
    row: fieldDefinitionRow,
    linkedSources: linkedSourcesByFieldDefinitionId.get(fieldDefinitionId) ?? [],
    sourceValues: sourceValuesByFieldDefinitionId.get(fieldDefinitionId) ?? {},
  });
}

export async function createFieldSourceType(input: { label: string }) {
  const label = normalizeFieldSourceTypeLabel(input.label);
  const key = getFieldSourceTypeKey(label);
  const existingFieldSourceType = await findExistingFieldSourceTypeByLabelOrKey({
    label,
    key,
  });

  if (existingFieldSourceType) {
    throw new FieldSourceTypeConflictError(
      "A source column with that name already exists.",
    );
  }

  const [{ nextSortOrder }] = await getDb()
    .select({
      nextSortOrder: sql<number>`coalesce(max(${fieldSourceTypes.sortOrder}), 0) + 1`,
    })
    .from(fieldSourceTypes);
  const [fieldSourceType] = await getDb()
    .insert(fieldSourceTypes)
    .values({
      key,
      label,
      sortOrder: nextSortOrder,
    })
    .returning();

  return toFieldSourceType(fieldSourceType);
}

export async function updateFieldSourceValue(input: {
  fieldDefinitionId: string;
  sourceTypeId: string;
  sourceFieldName: string;
}) {
  const [fieldDefinitionRow, fieldSourceTypeRow] = await Promise.all([
    getDb()
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.id, input.fieldDefinitionId))
      .limit(1),
    findFieldSourceTypeById(input.sourceTypeId),
  ]);

  if (!fieldDefinitionRow[0] || !fieldSourceTypeRow) {
    return null;
  }

  const sourceFieldName = normalizeSourceFieldName(input.sourceFieldName);

  if (!sourceFieldName) {
    await getDb()
      .delete(fieldDefinitionSources)
      .where(
        sql`${fieldDefinitionSources.fieldDefinitionId} = ${input.fieldDefinitionId} and ${fieldDefinitionSources.sourceTypeId} = ${input.sourceTypeId}`,
      );
  } else {
    await getDb()
      .insert(fieldDefinitionSources)
      .values({
        fieldDefinitionId: input.fieldDefinitionId,
        sourceTypeId: input.sourceTypeId,
        sourceFieldName,
      })
      .onConflictDoUpdate({
        target: [
          fieldDefinitionSources.fieldDefinitionId,
          fieldDefinitionSources.sourceTypeId,
        ],
        set: {
          sourceFieldName,
          updatedAt: new Date(),
        },
      });
  }

  return getFieldSourceGridRow(input.fieldDefinitionId);
}
