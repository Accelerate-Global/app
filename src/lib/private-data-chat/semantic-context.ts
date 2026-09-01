import { createHash } from "node:crypto";
import { z } from "zod";

import {
  PRIVATE_DATA_CHAT_CATALOG,
  PRIVATE_DATA_CHAT_FIELDS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRICS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
} from "@/lib/private-data-chat/catalog";
import {
  PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
} from "@/lib/private-data-chat/named-filters";
import {
  PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE,
  PRIVATE_DATA_CHAT_UUPG_GUIDANCE,
} from "@/lib/private-data-chat/semantic-guidance";
import {
  PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY,
  PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
  PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION,
} from "@/lib/private-data-chat/semantic-authority";
import { PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS } from "@/lib/private-data-chat/semantic-evaluation-corpus";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";

export { SEMANTIC_CONTEXT_RESOURCE_KEY as PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_RESOURCE_KEY } from "@/lib/reference-resources/types";

export const PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_SCHEMA_VERSION = 1 as const;
export const PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_MAX_CARDS = 1_000;

const semanticCardSchema = z
  .object({
    stableKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,149}$/u),
    kind: z.enum([
      "dataset",
      "field",
      "metric",
      "named-filter",
      "resource",
      "resource-operation",
      "relationship",
      "grain",
      "demonstration",
    ]),
    dataset: z.string().min(1).max(150).nullable(),
    grain: z.string().min(1).max(300),
    label: z.string().trim().min(1).max(200),
    definition: z.string().trim().min(1).max(2_000),
    aliases: z.array(z.string().trim().min(1).max(200)).max(50),
    valueType: z.enum(["text", "number", "boolean", "object"]).nullable(),
    unit: z.string().min(1).max(150).nullable(),
    nullMeaning: z.string().min(1).max(1_000).nullable(),
    allowedValuePolicy: z.string().min(1).max(1_000).nullable(),
    formula: z.string().min(1).max(2_000).nullable(),
    dependencies: z.array(z.string().min(1).max(150)).max(30),
    relationships: z.array(z.string().min(1).max(150)).max(20),
    safeJoinCapabilities: z.array(z.string().min(1).max(150)).max(10),
    resourceOperations: z.array(z.string().min(1).max(100)).max(10),
    examples: z.array(z.string().min(1).max(1_000)).max(10),
    counterexamples: z.array(z.string().min(1).max(1_000)).max(10),
    sourceReferences: z
      .array(
        z
          .object({
            sourceKey: z.string().min(1).max(200),
            version: z.string().min(1).max(200),
            freshness: z.string().min(1).max(200),
            checksum: z.string().regex(/^[0-9a-f]{64}$/u).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    sensitivity: z.literal("private-internal"),
    audiences: z.array(z.enum(["planner", "answer"])).min(1).max(2),
    retrievalTags: z.array(z.string().min(1).max(100)).max(30),
    queryAuthority: z.enum([
      "queryable",
      "explanatory-only",
      "resolver-only",
      "excluded",
    ]),
    contextualSearchText: z.string().min(1).max(8_000),
    contentChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
  })
  .strict();

export type PrivateDataChatSemanticCard = z.infer<typeof semanticCardSchema>;

export const privateDataChatSemanticContextPackageSchema = z
  .object({
    schemaVersion: z.literal(PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_SCHEMA_VERSION),
    sourceName: z.literal("Accelerate Global reviewed semantic definition package"),
    sourceRetrievedAt: z.string().datetime(),
    sourceVersionManifest: z.record(z.string(), z.string().min(1).max(500)),
    definitionPackageChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
    guidingDocument: z.string().min(1).max(1_000_000),
    guidingDocumentChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
    entries: z
      .array(semanticCardSchema)
      .min(1)
      .max(PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_MAX_CARDS),
  })
  .strict();

export type PrivateDataChatSemanticContextPackage = z.infer<
  typeof privateDataChatSemanticContextPackageSchema
>;

export type PrivateDataChatSemanticContextFinding = Readonly<{
  severity: "info" | "warning" | "error";
  ruleCode: string;
  message: string;
  stableEntryKey?: string;
  fieldName?: string;
}>;

export type PrivateDataChatSemanticSourceFieldDefinition = Readonly<{
  canonicalKey: string;
  label: string;
  definition: string;
  updatedAt: string;
  sourcePriorityKeys?: readonly string[];
}>;

export type PrivateDataChatSemanticResourceSummary = Readonly<{
  resourceKey: string;
  label: string;
  description: string;
  versionId: string;
  versionNumber: number;
  contentChecksum: string | null;
  sourceRetrievedAt: string;
  entryCount: number;
}>;

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedAliases(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function contextualSearchText(input: {
  stableKey: string;
  kind: string;
  dataset: string | null;
  grain: string;
  label: string;
  definition: string;
  aliases: readonly string[];
  retrievalTags: readonly string[];
  sourceReferences: readonly { sourceKey: string; version: string }[];
}) {
  return [
    input.dataset ? `dataset ${input.dataset}` : null,
    `grain ${input.grain}`,
    `kind ${input.kind}`,
    `key ${input.stableKey}`,
    `label ${input.label}`,
    `definition ${input.definition}`,
    input.aliases.length > 0 ? `aliases ${input.aliases.join(" | ")}` : null,
    input.retrievalTags.length > 0
      ? `tags ${input.retrievalTags.join(" | ")}`
      : null,
    ...input.sourceReferences.map(
      (source) => `source ${source.sourceKey} version ${source.version}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

type CardInput = Omit<
  PrivateDataChatSemanticCard,
  "contextualSearchText" | "contentChecksum"
>;

function makeCard(input: CardInput): PrivateDataChatSemanticCard {
  const aliases = normalizedAliases(input.aliases);
  const retrievalTags = normalizedAliases(input.retrievalTags);
  const content = { ...input, aliases, retrievalTags };
  return semanticCardSchema.parse({
    ...content,
    contextualSearchText: contextualSearchText({
      ...content,
      sourceReferences: content.sourceReferences,
    }),
    contentChecksum: checksum(content),
  });
}

export function rebuildPrivateDataChatSemanticCard(
  card: PrivateDataChatSemanticCard,
  updates: Partial<Pick<PrivateDataChatSemanticCard, "definition" | "aliases">>,
) {
  const { contextualSearchText, contentChecksum, ...input } = card;
  void contextualSearchText;
  void contentChecksum;
  return makeCard({ ...input, ...updates });
}

export function renderPrivateDataChatSemanticGuidingDocument(
  cards: readonly PrivateDataChatSemanticCard[],
) {
  const sections = [
    "# Accelerate Global private-Qwen semantic definitions",
    "",
    "> This document and the structured semantic cards are two projections of one reviewed package. Edit only supported Definition or Aliases sections; activation fails on drift or ambiguity.",
    "",
    ...cards.flatMap((card) => [
      `<!-- SEMANTIC-CARD key=${JSON.stringify(card.stableKey)} checksum=${JSON.stringify(card.contentChecksum)} -->`,
      `## ${card.label} (\`${card.stableKey}\`)`,
      "",
      `Authority: \`${card.queryAuthority}\``,
      "",
      "Definition:",
      card.definition,
      "",
      "Aliases:",
      JSON.stringify(card.aliases),
      "",
      `<!-- END SEMANTIC-CARD ${card.stableKey} -->`,
      "",
    ]),
  ];
  return `${sections.join("\n").trimEnd()}\n`;
}

export function calculatePrivateDataChatDefinitionPackageChecksum(
  cards: readonly PrivateDataChatSemanticCard[],
) {
  return checksum(
    cards.map(({ contextualSearchText, ...card }) => {
      void contextualSearchText;
      return card;
    }),
  );
}

export function rebuildPrivateDataChatSemanticContextPackage(input: {
  base: PrivateDataChatSemanticContextPackage;
  entries: readonly PrivateDataChatSemanticCard[];
  sourceRetrievedAt?: string;
}) {
  const entries = [...input.entries].sort((left, right) =>
    left.stableKey.localeCompare(right.stableKey),
  );
  const guidingDocument = renderPrivateDataChatSemanticGuidingDocument(entries);
  return privateDataChatSemanticContextPackageSchema.parse({
    ...input.base,
    sourceRetrievedAt: input.sourceRetrievedAt ?? input.base.sourceRetrievedAt,
    definitionPackageChecksum:
      calculatePrivateDataChatDefinitionPackageChecksum(entries),
    guidingDocument,
    guidingDocumentChecksum: checksum(guidingDocument),
    entries,
  });
}

function coreSourceReferences(fieldDefinitions: readonly PrivateDataChatSemanticSourceFieldDefinition[]) {
  const latest = fieldDefinitions
    .map((item) => item.updatedAt)
    .sort()
    .at(-1);
  return [
    {
      sourceKey: "private-data-chat-catalog",
      version: PRIVATE_DATA_CHAT_CATALOG.version,
      freshness: "release-bound",
      checksum: PRIVATE_DATA_CHAT_CATALOG.checksum,
    },
    {
      sourceKey: "field-definitions",
      version: latest ?? "no-source-version",
      freshness: latest ?? "not supplied",
      checksum: null,
    },
  ];
}

export function buildPrivateDataChatSemanticContextPackage(input: {
  sourceRetrievedAt: string;
  fieldDefinitions?: readonly PrivateDataChatSemanticSourceFieldDefinition[];
  resourceSummaries?: readonly PrivateDataChatSemanticResourceSummary[];
  additionalSourceVersions?: Readonly<Record<string, string>>;
}) {
  const fieldDefinitions = input.fieldDefinitions ?? [];
  const resourceSummaries = input.resourceSummaries ?? [];
  const additionalSourceVersions = input.additionalSourceVersions ?? {};
  const findings: PrivateDataChatSemanticContextFinding[] = [];
  const cards: PrivateDataChatSemanticCard[] = [];
  const coreSources = coreSourceReferences(fieldDefinitions);

  cards.push(
    makeCard({
      stableKey: "dataset.primary_people_groups",
      kind: "dataset",
      dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
      grain: PRIVATE_DATA_CHAT_CATALOG.dataset.grain.description,
      label: PRIVATE_DATA_CHAT_CATALOG.dataset.label,
      definition: PRIVATE_DATA_CHAT_CATALOG.dataset.description,
      aliases: ["primary people groups", "current people-group dataset"],
      valueType: "object",
      unit: null,
      nullMeaning: null,
      allowedValuePolicy: null,
      formula: null,
      dependencies: [],
      relationships: ["relationship.people_group_to_bound_rop3"],
      safeJoinCapabilities: ["people_group_to_bound_rop3"],
      resourceOperations: [],
      examples: ["How many people groups are in the current dataset?"],
      counterexamples: ["Answer an unrelated general-knowledge question."],
      sourceReferences: coreSources,
      sensitivity: "private-internal",
      audiences: ["planner", "answer"],
      retrievalTags: ["dataset", "grain", "people groups"],
      queryAuthority: "explanatory-only",
    }),
  );

  for (const key of PRIVATE_DATA_CHAT_FILTER_KEYS) {
    const field = PRIVATE_DATA_CHAT_FIELDS[key];
    const isRopField = key.startsWith("rop");
    const sourceDefinition = fieldDefinitions.find((candidate) =>
      field.provenance.canonicalFieldDefinitionKeys.includes(
        candidate.canonicalKey,
      ),
    );
    if (
      key === "globally_engaged" &&
      sourceDefinition?.definition.trim() &&
      sourceDefinition.definition.trim() !==
        PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.definition
    ) {
      findings.push({
        severity: "warning",
        ruleCode: "semantic-definition-reviewed-overlay",
        stableEntryKey: `field.${key}`,
        fieldName: sourceDefinition.canonicalKey,
        message:
          "The reviewed private-chat definition supersedes conflicting legacy wording without changing the source field or approved boolean direction.",
      });
    }

    cards.push(
      makeCard({
        stableKey: `field.${key}`,
        kind: "field",
        dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
        grain: PRIVATE_DATA_CHAT_CATALOG.dataset.grain.description,
        label: field.label,
        definition:
          key === "globally_engaged"
            ? PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.definition
            : field.description,
        aliases: [...field.aliases],
        valueType: field.valueType,
        unit: field.unit,
        nullMeaning:
          key === "globally_engaged"
            ? PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.valueMeanings.null
            : field.nullMeaning,
        allowedValuePolicy: field.valueDomain.kind,
        formula: null,
        dependencies:
          key === "rop_geography"
            ? ["operation.rop_geography_exists"]
            : isRopField
              ? ["relationship.people_group_to_bound_rop3"]
              : [],
        relationships: isRopField ? ["people_group_to_bound_rop3"] : [],
        safeJoinCapabilities: isRopField
          ? ["people_group_to_bound_rop3"]
          : [],
        resourceOperations: [],
        examples: [],
        counterexamples: [],
        sourceReferences: isRopField
          ? [
              {
                sourceKey: "semantic-authority-registry",
                version: PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION,
                freshness: "release-bound",
                checksum: null,
              },
            ]
          : coreSources,
        sensitivity: "private-internal",
        audiences: ["planner", "answer"],
        retrievalTags: ["field", key, ...field.aliases],
        queryAuthority: "queryable",
      }),
    );
  }

  for (const key of PRIVATE_DATA_CHAT_METRIC_KEYS) {
    const metric = PRIVATE_DATA_CHAT_METRICS[key];
    cards.push(
      makeCard({
        stableKey: `metric.${key}`,
        kind: "metric",
        dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
        grain: PRIVATE_DATA_CHAT_CATALOG.dataset.grain.description,
        label: metric.label,
        definition: metric.description,
        aliases: metric.aliases,
        valueType: "number",
        unit: metric.unit,
        nullMeaning: metric.nullMeaning,
        allowedValuePolicy: null,
        formula: metric.semanticFormula,
        dependencies: metric.dependencies.map((item) => `field.${item}`),
        relationships: [],
        safeJoinCapabilities: [],
        resourceOperations: [],
        examples: [],
        counterexamples: [],
        sourceReferences: coreSources,
        sensitivity: "private-internal",
        audiences: ["planner", "answer"],
        retrievalTags: ["metric", key, ...metric.aliases],
        queryAuthority: "queryable",
      }),
    );
  }

  cards.push(
    makeCard({
      stableKey: "filter.uupg",
      kind: "named-filter",
      dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
      grain: PRIVATE_DATA_CHAT_CATALOG.dataset.grain.description,
      label: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.label,
      definition: `${PRIVATE_DATA_CHAT_UUPG_GUIDANCE.definition} ${PRIVATE_DATA_CHAT_UUPG_GUIDANCE.nullPreservingRationale} ${PRIVATE_DATA_CHAT_UUPG_GUIDANCE.baselineDistinction}`,
      aliases: ["unreached unengaged people groups", "current UUPG filter"],
      valueType: "boolean",
      unit: "filter",
      nullMeaning: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.nullPreservingRationale,
      allowedValuePolicy:
        "Select reviewed UUPG version 1 and independently enabled criteria; at least one criterion must remain enabled.",
      formula:
        "(globally_engaged=false OR source value is blank) AND (frontier_group=true OR source value is blank), restricted to enabled branches.",
      dependencies: ["field.globally_engaged", "field.frontier_group"],
      relationships: [],
      safeJoinCapabilities: [],
      resourceOperations: [],
      examples: ["How many rows match this UUPG view?"],
      counterexamples: ["Treat a blank value as affirmative true or false."],
      sourceReferences: [
        {
          sourceKey: "named-filter-registry",
          version: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
          freshness: "release-bound",
          checksum: null,
        },
      ],
      sensitivity: "private-internal",
      audiences: ["planner", "answer"],
      retrievalTags: ["uupg", "filter", "null preserving", "blank"],
      queryAuthority: "queryable",
    }),
  );

  const resourceSummaryByKey = new Map(
    resourceSummaries.map((summary) => [summary.resourceKey, summary]),
  );
  for (const resourceKey of [COUNTRY_RESOURCE_KEY, ROP_RESOURCE_KEY] as const) {
    const summary = resourceSummaryByKey.get(resourceKey);
    const operations =
      resourceKey === ROP_RESOURCE_KEY
        ? PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources[ROP_RESOURCE_KEY]
            .operations
        : [];
    cards.push(
      makeCard({
        stableKey: `resource.${resourceKey.replaceAll("-", "_")}`,
        kind: "resource",
        dataset: null,
        grain: resourceKey === ROP_RESOURCE_KEY ? "ROP entry" : "country entry",
        label: summary?.label ?? resourceKey,
        definition:
          summary?.description ??
          (resourceKey === ROP_RESOURCE_KEY
            ? "HIS Registry of Peoples hierarchy, entry, and geography reference resource."
            : "Approved country and territory code/alias reference resource."),
        aliases: resourceKey === ROP_RESOURCE_KEY ? ["ROP", "registry of peoples"] : ["country codes"],
        valueType: "object",
        unit: "reference entries",
        nullMeaning: "An unavailable version fails closed.",
        allowedValuePolicy:
          resourceKey === ROP_RESOURCE_KEY
            ? "Complete authenticated resource is reachable through bounded typed pages; it is never bulk-injected into a prompt."
            : "Exact deterministic alias resolution only.",
        formula: null,
        dependencies:
          resourceKey === ROP_RESOURCE_KEY ? ["resolver.rop_name"] : [],
        relationships:
          resourceKey === ROP_RESOURCE_KEY
            ? ["relationship.people_group_to_bound_rop3"]
            : [],
        safeJoinCapabilities:
          resourceKey === ROP_RESOURCE_KEY ? ["people_group_to_bound_rop3"] : [],
        resourceOperations: [...operations],
        examples: [],
        counterexamples: ["Let Qwen choose a physical table or join condition."],
        sourceReferences: [
          {
            sourceKey: resourceKey,
            version: summary
              ? `${summary.versionNumber}:${summary.versionId}`
              : "active-version-required",
            freshness: summary?.sourceRetrievedAt ?? "not loaded",
            checksum: summary?.contentChecksum ?? null,
          },
        ],
        sensitivity: "private-internal",
        audiences: ["planner", "answer"],
        retrievalTags: ["resource", resourceKey, ...operations],
        queryAuthority:
          resourceKey === ROP_RESOURCE_KEY ? "queryable" : "resolver-only",
      }),
    );
  }

  for (const operation of
    PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources[ROP_RESOURCE_KEY]
      .operations) {
    cards.push(
      makeCard({
        stableKey: `operation.rop_${operation}`,
        kind: "resource-operation",
        dataset: null,
        grain: "bounded ROP result page",
        label: `ROP ${operation}`,
        definition: `Reviewed read-only ${operation} operation over the complete permitted ROP resource with a maximum 25-row chat page.`,
        aliases: [`${operation} ROP`, `ROP ${operation}`],
        valueType: "object",
        unit: "ROP entries",
        nullMeaning: "Unavailable resource/version fails closed.",
        allowedValuePolicy: "Typed resource-query operation only.",
        formula: null,
        dependencies:
          operation === "list"
            ? ["resource.rop_codes", "operation.rop_continue"]
            : ["resource.rop_codes"],
        relationships: [],
        safeJoinCapabilities: [],
        resourceOperations: [operation],
        examples: [],
        counterexamples: ["Mutate or activate a ROP resource version through chat."],
        sourceReferences: [
          {
            sourceKey: "resource-operation-registry",
            version: PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION,
            freshness: "release-bound",
            checksum: null,
          },
        ],
        sensitivity: "private-internal",
        audiences: ["planner", "answer"],
        retrievalTags: ["rop", "resource operation", operation],
        queryAuthority: "queryable",
      }),
    );
  }

  cards.push(
    makeCard({
      stableKey: "relationship.people_group_to_bound_rop3",
      kind: "relationship",
      dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
      grain: "people group to one bound ROP3 classification",
      label: "People group to dataset-bound ROP3",
      definition:
        "Server-owned many-to-one, left, null-preserving relationship using the exact ROP version recorded in dataset production lineage; it never falls back to the current active version.",
      aliases: ["bound ROP3 relationship", "people group ROP join"],
      valueType: "object",
      unit: "relationship",
      nullMeaning:
        "Blank, malformed, inactive, unmatched, and join-issue values remain visible through typed match status.",
      allowedValuePolicy: "Model may select semantic ROP fields but never physical keys or ON clauses.",
      formula: null,
      dependencies: [
        "resource.rop_codes",
        "lineage.rop_bound_version",
      ],
      relationships: ["people_group_to_bound_rop3"],
      safeJoinCapabilities: ["people_group_to_bound_rop3"],
      resourceOperations: [],
      examples: ["Group people groups by the ROP2 name bound to this dataset."],
      counterexamples: ["Join the dataset to whichever ROP version is active today."],
      sourceReferences: [
        {
          sourceKey: "relationship-registry",
          version: PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION,
          freshness: "release-bound",
          checksum: null,
        },
      ],
      sensitivity: "private-internal",
      audiences: ["planner", "answer"],
      retrievalTags: ["relationship", "join", "rop3", "dataset lineage"],
      queryAuthority: "queryable",
    }),
  );

  const semanticAuthoritySource = [
    {
      sourceKey: "semantic-authority-registry",
      version: PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION,
      freshness: "release-bound",
      checksum: null,
    },
  ];
  for (const card of [
    {
      stableKey: "lineage.rop_bound_version",
      kind: "relationship" as const,
      grain: "dataset production lineage",
      label: "Dataset-bound ROP version",
      definition:
        "ROP classifications for people-group queries use the immutable ROP resource version recorded by the dataset producer/forming run, never whichever version is active today.",
      aliases: ["bound ROP version", "dataset ROP version"],
      dependencies: ["resource.rop_codes"],
      relationships: ["people_group_to_bound_rop3"],
      retrievalTags: ["lineage", "bound version", "active version drift"],
    },
    {
      stableKey: "resolver.rop_name",
      kind: "resource-operation" as const,
      grain: "canonical ROP term",
      label: "ROP name and code resolver",
      definition:
        "Exact normalized ROP codes and names resolve deterministically against one reviewed resource version; multiple exact matches require the user to choose.",
      aliases: ["ROP resolver", "ambiguous ROP name"],
      dependencies: [],
      relationships: [],
      retrievalTags: ["resolver", "exact code", "exact name", "ambiguity"],
    },
    {
      stableKey: "operation.rop_geography_exists",
      kind: "resource-operation" as const,
      grain: "people group",
      label: "ROP geography filter",
      definition:
        "A registered EXISTS-style ROP geography filter checks the bound ROP3 geography values without flattening or multiplying people-group rows.",
      aliases: ["ROP geography exists", "filter by ROP geography"],
      dependencies: ["relationship.people_group_to_bound_rop3"],
      relationships: ["people_group_to_bound_rop3"],
      retrievalTags: ["geography", "exists", "no row multiplication"],
    },
    {
      stableKey: "grain.rop_geography",
      kind: "grain" as const,
      grain: "one ROP geography record",
      label: "ROP geography result grain",
      definition:
        "Standalone ROP detail may return bounded geography records at an explicit geography grain; they are not implicitly flattened into people-group aggregates.",
      aliases: ["ROP geography records", "geography detail"],
      dependencies: ["resource.rop_codes"],
      relationships: [],
      retrievalTags: ["geography", "grain", "ROP detail"],
    },
    {
      stableKey: "result.matched_count",
      kind: "grain" as const,
      grain: "bounded query result",
      label: "Matching count",
      definition:
        "The exact number of records that match the query before the requested row limit is applied.",
      aliases: ["matched count", "total matches", "103 match"],
      dependencies: [],
      relationships: [],
      retrievalTags: ["completeness", "matching", "total"],
    },
    {
      stableKey: "result.returned_count",
      kind: "grain" as const,
      grain: "bounded query result",
      label: "Returned count",
      definition:
        "The number of bounded rows returned on this page; it is not the total when matching count is larger.",
      aliases: ["returned count", "showing 100", "page size"],
      dependencies: ["result.matched_count"],
      relationships: [],
      retrievalTags: ["completeness", "returned", "limit"],
    },
  ]) {
    cards.push(
      makeCard({
        ...card,
        dataset: card.stableKey.startsWith("result.")
          ? PRIVATE_DATA_CHAT_CATALOG.dataset.key
          : null,
        valueType: card.stableKey.startsWith("result.") ? "number" : "object",
        unit: card.stableKey.startsWith("result.") ? "records" : null,
        nullMeaning: null,
        allowedValuePolicy: "Server-owned reviewed semantic behavior only.",
        formula: null,
        safeJoinCapabilities: card.relationships,
        resourceOperations: [],
        examples: [],
        counterexamples: [],
        sourceReferences: semanticAuthoritySource,
        sensitivity: "private-internal",
        audiences: ["planner", "answer"],
        queryAuthority: "explanatory-only",
      }),
    );
  }

  const demonstrations = PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.filter(
    (item) => item.demonstrationEligible,
  );
  for (const demonstration of demonstrations) {
    cards.push(
      makeCard({
        stableKey: `demonstration.${demonstration.id.replaceAll("_", "-")}`,
        kind: "demonstration",
        dataset: PRIVATE_DATA_CHAT_CATALOG.dataset.key,
        grain: "semantic-plan example",
        label: demonstration.intentGroup,
        definition: demonstration.question,
        aliases: [],
        valueType: "object",
        unit: null,
        nullMeaning: null,
        allowedValuePolicy:
          "Non-authoritative question-to-typed-plan guidance; never SQL or compiler mapping.",
        formula: demonstration.planSkeleton,
        dependencies: [...demonstration.humanRelevance.requiredCardKeys],
        relationships: demonstration.expected.relationshipKey
          ? [demonstration.expected.relationshipKey]
          : [],
        safeJoinCapabilities: demonstration.expected.relationshipKey
          ? [demonstration.expected.relationshipKey]
          : [],
        resourceOperations: demonstration.expected.resourceOperation
          ? [demonstration.expected.resourceOperation]
          : [],
        examples: [demonstration.question],
        counterexamples: [],
        sourceReferences: [
          {
            sourceKey: "semantic-evaluation-corpus",
            version: "semantic-evaluation-v1",
            freshness: "grouped train partition",
            checksum: null,
          },
        ],
        sensitivity: "private-internal",
        audiences: ["planner"],
        retrievalTags: ["demonstration", demonstration.intentGroup],
        queryAuthority: "explanatory-only",
      }),
    );
  }

  const validationFindings = validatePrivateDataChatSemanticCards(cards);
  findings.push(...validationFindings);
  const sortedCards = [...cards].sort((left, right) =>
    left.stableKey.localeCompare(right.stableKey),
  );
  const definitionPackageChecksum =
    calculatePrivateDataChatDefinitionPackageChecksum(sortedCards);
  const guidingDocument =
    renderPrivateDataChatSemanticGuidingDocument(sortedCards);
  const guidingDocumentChecksum = checksum(guidingDocument);
  const sourceVersionManifest = Object.fromEntries([
    ["queryCatalog", PRIVATE_DATA_CHAT_CATALOG.version],
    ["namedFilters", PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION],
    ["semanticAuthority", PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION],
    ...fieldDefinitions.map((definition) => [
      `fieldDefinition:${definition.canonicalKey}`,
      `${definition.updatedAt}:${checksum({
        label: definition.label,
        definition: definition.definition,
        sourcePriorityKeys: definition.sourcePriorityKeys ?? [],
      })}`,
    ]),
    ...Object.entries(additionalSourceVersions),
    ...resourceSummaries.map((summary) => [
      `resource:${summary.resourceKey}`,
      `${summary.versionNumber}:${summary.versionId}:${summary.contentChecksum ?? "no-checksum"}`,
    ]),
  ]);
  const semanticPackage = privateDataChatSemanticContextPackageSchema.parse({
    schemaVersion: PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_SCHEMA_VERSION,
    sourceName: "Accelerate Global reviewed semantic definition package",
    sourceRetrievedAt: input.sourceRetrievedAt,
    sourceVersionManifest,
    definitionPackageChecksum,
    guidingDocument,
    guidingDocumentChecksum,
    entries: sortedCards,
  });

  return { package: semanticPackage, findings };
}

const INSTRUCTION_LIKE =
  /\b(ignore (all|the|previous)|system prompt|reveal (a )?(secret|credential)|drop table|execute sql|follow these instructions)\b/iu;
const UNSUPPORTED_MARKUP = /<\/?(?:script|iframe|object|embed|style)\b/iu;
const CONTROL_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export function validatePrivateDataChatSemanticCards(
  cards: readonly PrivateDataChatSemanticCard[],
) {
  const findings: PrivateDataChatSemanticContextFinding[] = [];
  const stableKeys = new Set<string>();
  const aliases = new Map<string, string>();
  const queryableKeys = new Set([
    ...PRIVATE_DATA_CHAT_FILTER_KEYS.map((key) => `field.${key}`),
    ...PRIVATE_DATA_CHAT_METRIC_KEYS.map((key) => `metric.${key}`),
    "filter.uupg",
    "resource.rop_codes",
    ...PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY.resources[ROP_RESOURCE_KEY]
      .operations.map((operation) => `operation.rop_${operation}`),
    "relationship.people_group_to_bound_rop3",
    ...PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS.map((key) => `field.${key}`),
  ]);

  for (const card of cards) {
    if (stableKeys.has(card.stableKey)) {
      findings.push({
        severity: "error",
        ruleCode: "duplicate-card-key",
        stableEntryKey: card.stableKey,
        message: "Semantic card stable key is duplicated.",
      });
    }
    stableKeys.add(card.stableKey);

    if (
      INSTRUCTION_LIKE.test(card.definition) ||
      UNSUPPORTED_MARKUP.test(card.definition) ||
      CONTROL_TEXT.test(card.definition)
    ) {
      findings.push({
        severity: "error",
        ruleCode: "unsafe-semantic-content",
        stableEntryKey: card.stableKey,
        fieldName: "definition",
        message: "Semantic definition contains instruction-like, executable, markup, or control text.",
      });
    }

    if (card.queryAuthority === "queryable" && !queryableKeys.has(card.stableKey)) {
      findings.push({
        severity: "error",
        ruleCode: "semantic-authority-widening",
        stableEntryKey: card.stableKey,
        fieldName: "queryAuthority",
        message: "Semantic retrieval cannot create query authority absent from the active allowlists.",
      });
    }

    for (const alias of card.aliases) {
      const normalized = alias.toLocaleLowerCase();
      const previous = aliases.get(normalized);
      if (previous && previous !== card.stableKey) {
        findings.push({
          severity: "error",
          ruleCode: "duplicate-semantic-alias",
          stableEntryKey: card.stableKey,
          fieldName: "aliases",
          message: `Alias ${alias} is shared with ${previous}.`,
        });
      }
      aliases.set(normalized, card.stableKey);
    }
  }

  return findings;
}
