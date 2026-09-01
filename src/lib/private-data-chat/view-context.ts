import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { datasets } from "@/db/schema";
import type { SavedDatasetFilterState } from "@/lib/api-types";
import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
  PRIVATE_DATA_CHAT_FIELDS,
} from "@/lib/private-data-chat/catalog";
import {
  PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
  PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION,
} from "@/lib/private-data-chat/named-filters";
import {
  privateDataChatFilterSchema,
  privateDataChatNamedFilterSchema,
  privateDataChatSortSchema,
  type PrivateDataChatFilter,
  type PrivateDataChatNamedFilter,
} from "@/lib/private-data-chat/schemas";
import { PRIVATE_DATA_CHAT_UUPG_GUIDANCE } from "@/lib/private-data-chat/semantic-guidance";
import {
  privateDataChatSubjectBinding,
  PrivateDataChatSignedStateError,
  signPrivateDataChatState,
  verifyPrivateDataChatState,
} from "@/lib/private-data-chat/signed-state";

export const PRIVATE_DATA_CHAT_VIEW_CONTEXT_TTL_MS = 30 * 60 * 1_000;
export const PRIVATE_DATA_CHAT_VIEW_CONTEXT_STORAGE_KEY =
  "private-data-chat:view-context:v1";
const VIEW_CONTEXT_PURPOSE = "current-view";

const summarySchema = z
  .object({
    chips: z
      .array(
        z.object({ label: z.string().min(1).max(100), detail: z.string().max(500).nullable() }).strict(),
      )
      .min(1)
      .max(12),
    quickQuestions: z.array(z.string().min(1).max(300)).max(6),
    returnUrl: z.string().startsWith("/dashboard/datasets/"),
    uupgRationale: z.string().max(2_000).nullable(),
  })
  .strict();

const payloadSchema = z
  .object({
    version: z.literal(1),
    subject: z.string().regex(/^[0-9a-f]{64}$/u),
    conversationId: z.string().uuid(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    catalogVersion: z.literal(PRIVATE_DATA_CHAT_CATALOG_VERSION),
    namedFilterRegistryVersion: z.literal(
      PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
    ),
    dataset: z.literal(PRIVATE_DATA_CHAT_DATASET_KEY),
    datasetId: z.string().uuid(),
    datasetVersionCreatedAt: z.string().datetime(),
    filters: z.array(privateDataChatFilterSchema).max(6),
    namedFilters: z.array(privateDataChatNamedFilterSchema).max(2),
    sort: z.array(privateDataChatSortSchema).max(3),
    summary: summarySchema,
  })
  .strict();

export type PrivateDataChatViewContext = z.infer<typeof payloadSchema>;
export type PrivateDataChatViewContextSummary = z.infer<typeof summarySchema>;

export class PrivateDataChatViewContextError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PrivateDataChatViewContextError";
    this.code = code;
  }
}

function normalizedColumn(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

const sortFieldByColumn = new Map<string, keyof typeof PRIVATE_DATA_CHAT_FIELDS>();
for (const [key, field] of Object.entries(PRIVATE_DATA_CHAT_FIELDS)) {
  const uses = field.uses as readonly string[];
  if (!uses.includes("record") && !uses.includes("dimension")) continue;
  sortFieldByColumn.set(normalizedColumn(key), key as keyof typeof PRIVATE_DATA_CHAT_FIELDS);
  sortFieldByColumn.set(normalizedColumn(field.column), key as keyof typeof PRIVATE_DATA_CHAT_FIELDS);
  for (const canonical of field.provenance.canonicalFieldDefinitionKeys) {
    sortFieldByColumn.set(normalizedColumn(canonical), key as keyof typeof PRIVATE_DATA_CHAT_FIELDS);
  }
}

function unique(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

export function buildPrivateDataChatViewContextDraft(input: {
  datasetId: string;
  filters: SavedDatasetFilterState;
}) {
  if (input.filters.watchlist.enabled) {
    throw new PrivateDataChatViewContextError(
      "unsupported-current-view-filter",
      "The Watchlist filter is not yet available in private data chat. Clear it before handing off this view.",
    );
  }
  if (input.filters.hotspots?.enabled) {
    throw new PrivateDataChatViewContextError(
      "unsupported-current-view-filter",
      "The Hotspots filter is not yet available in private data chat. Clear it before handing off this view.",
    );
  }
  if (
    input.filters.country.enabled &&
    input.filters.country.includeAlternateCountries
  ) {
    throw new PrivateDataChatViewContextError(
      "unsupported-current-view-filter",
      "Alternate-country matching cannot be reproduced by the approved chat projection.",
    );
  }

  const globalRegion = input.filters.region.selectedRegionNames.some(
    (name) => normalizedColumn(name) === "global",
  );
  const regionCountries =
    input.filters.region.enabled && !globalRegion
      ? unique(input.filters.region.enabledCountryNames)
      : [];
  const countryCountries = input.filters.country.enabled
    ? unique(input.filters.country.selectedCountryNames)
    : [];
  if (input.filters.country.enabled && countryCountries.length === 0) {
    throw new PrivateDataChatViewContextError(
      "empty-current-view",
      "The current country selection contains no rows. Select at least one country before handing it to chat.",
    );
  }
  const countryNames =
    regionCountries.length > 0 && countryCountries.length > 0
      ? regionCountries.filter((country) => countryCountries.includes(country))
      : regionCountries.length > 0
        ? regionCountries
        : countryCountries;
  if (countryNames.length > 50) {
    throw new PrivateDataChatViewContextError(
      "current-view-too-broad",
      "This view expands to more than 50 countries. Narrow it before handing it to chat.",
    );
  }
  if (
    (regionCountries.length > 0 || countryCountries.length > 0) &&
    countryNames.length === 0
  ) {
    throw new PrivateDataChatViewContextError(
      "empty-current-view",
      "The current region and country filters have no overlap.",
    );
  }

  const filters: PrivateDataChatFilter[] = countryNames.length
    ? [
        {
          field: "country",
          operator: countryNames.length === 1 ? "eq" : "in",
          value: countryNames.length === 1 ? countryNames[0]! : countryNames,
        },
      ]
    : [];
  const namedFilters: PrivateDataChatNamedFilter[] = input.filters.uupg.enabled
    ? [
        {
          key: "uupg",
          version: PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION,
          options: {
            globalEngagementAnywhereEnabled:
              input.filters.uupg.globalEngagementAnywhereEnabled ?? true,
            frontierGroupEnabled:
              input.filters.uupg.frontierGroupEnabled ?? true,
          },
        },
      ]
    : [];
  if (
    namedFilters[0] &&
    !namedFilters[0].options.globalEngagementAnywhereEnabled &&
    !namedFilters[0].options.frontierGroupEnabled
  ) {
    throw new PrivateDataChatViewContextError(
      "invalid-current-view-filter",
      "At least one UUPG criterion must remain enabled.",
    );
  }

  const sort = input.filters.sorting.slice(0, 3).map((item) => {
    const field = sortFieldByColumn.get(normalizedColumn(item.id));
    if (!field || field === "rop_geography") {
      throw new PrivateDataChatViewContextError(
        "unsupported-current-view-sort",
        `The current sort field ${item.id} is not available in private data chat.`,
      );
    }
    return privateDataChatSortSchema.parse({
      field,
      direction: item.desc ? "desc" : "asc",
    });
  });

  const chips: PrivateDataChatViewContextSummary["chips"] = [
    { label: "All People Groups", detail: null },
    ...(countryNames.length <= 10
      ? countryNames.map((country) => ({ label: country, detail: "Country filter" }))
      : [
          {
            label: `${countryNames.length} countries`,
            detail: "Region/country filter",
          },
        ]),
    ...(namedFilters.length
      ? [
          {
            label: "UUPG",
            detail: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.definition,
          },
        ]
      : []),
  ];
  return {
    filters,
    namedFilters,
    sort,
    summary: summarySchema.parse({
      chips,
      quickQuestions: [
        "How many people groups match this view?",
        "Show total population for this view.",
        ...(namedFilters.length ? ["Why does this UUPG view include blank values?"] : []),
      ],
      returnUrl: `/dashboard/datasets/${input.datasetId}`,
      uupgRationale: namedFilters.length
        ? PRIVATE_DATA_CHAT_UUPG_GUIDANCE.nullPreservingRationale
        : null,
    }),
  };
}

export async function getPrivateDataChatCurrentPrimaryDatasetVersion() {
  const [row] = await getDb()
    .select({
      id: datasets.id,
      versionCreatedAt: datasets.currentVersionCreatedAt,
    })
    .from(datasets)
    .where(
      and(
        eq(datasets.isPrimary, true),
        eq(datasets.status, "ready"),
        eq(datasets.isWorkspaceVisible, true),
      ),
    )
    .orderBy(desc(datasets.updatedAt), desc(datasets.id))
    .limit(1);
  return row
    ? { id: row.id, versionCreatedAt: row.versionCreatedAt.toISOString() }
    : null;
}

export function createPrivateDataChatViewContextToken(input: {
  ownerId: string;
  conversationId: string;
  datasetId: string;
  datasetVersionCreatedAt: string;
  filters: PrivateDataChatFilter[];
  namedFilters: PrivateDataChatNamedFilter[];
  sort: z.infer<typeof privateDataChatSortSchema>[];
  summary: PrivateDataChatViewContextSummary;
  key: string;
  now?: number;
  ttlMs?: number;
}) {
  const issuedAt = input.now ?? Date.now();
  const payload = payloadSchema.parse({
    version: 1,
    subject: privateDataChatSubjectBinding({ ownerId: input.ownerId, key: input.key }),
    conversationId: input.conversationId,
    issuedAt,
    expiresAt: issuedAt + (input.ttlMs ?? PRIVATE_DATA_CHAT_VIEW_CONTEXT_TTL_MS),
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
    dataset: PRIVATE_DATA_CHAT_DATASET_KEY,
    datasetId: input.datasetId,
    datasetVersionCreatedAt: input.datasetVersionCreatedAt,
    filters: input.filters,
    namedFilters: input.namedFilters,
    sort: input.sort,
    summary: input.summary,
  });
  return signPrivateDataChatState({ purpose: VIEW_CONTEXT_PURPOSE, payload, key: input.key });
}

export function verifyPrivateDataChatViewContextToken(input: {
  token: string;
  ownerId: string;
  conversationId: string;
  key: string;
  now?: number;
  currentDataset?: { id: string; versionCreatedAt: string } | null;
}) {
  const parsed = payloadSchema.safeParse(
    verifyPrivateDataChatState({ purpose: VIEW_CONTEXT_PURPOSE, token: input.token, key: input.key }),
  );
  if (!parsed.success) {
    throw new PrivateDataChatSignedStateError(
      "view_context_invalid",
      "The current-view context is invalid.",
    );
  }
  const payload = parsed.data;
  const now = input.now ?? Date.now();
  if (
    payload.subject !== privateDataChatSubjectBinding({ ownerId: input.ownerId, key: input.key }) ||
    payload.conversationId !== input.conversationId ||
    payload.expiresAt <= now ||
    payload.issuedAt > now + 60_000 ||
    (input.currentDataset &&
      (payload.datasetId !== input.currentDataset.id ||
        payload.datasetVersionCreatedAt !== input.currentDataset.versionCreatedAt))
  ) {
    throw new PrivateDataChatSignedStateError(
      "view_context_invalid",
      "The current-view context is invalid, expired, or stale.",
    );
  }
  return payload;
}

export async function verifyPrivateDataChatViewContextAgainstCurrentDataset(input: {
  token: string;
  ownerId: string;
  conversationId: string;
  key: string;
  now?: number;
}) {
  const currentDataset = await getPrivateDataChatCurrentPrimaryDatasetVersion();
  if (!currentDataset) {
    throw new PrivateDataChatSignedStateError(
      "view_context_invalid",
      "The approved current primary dataset is unavailable.",
    );
  }
  return verifyPrivateDataChatViewContextToken({
    ...input,
    currentDataset,
  });
}
