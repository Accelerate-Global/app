import { describe, expect, it } from "vitest";

import type { SavedDatasetFilterState } from "@/lib/api-types";
import {
  buildPrivateDataChatViewContextDraft,
  createPrivateDataChatViewContextToken,
  verifyPrivateDataChatViewContextToken,
} from "@/lib/private-data-chat/view-context";

const datasetId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000002";
const key = "view-context-test-key-that-is-at-least-thirty-two-bytes";
const versionCreatedAt = "2026-08-31T12:00:00.000Z";

function filters(): SavedDatasetFilterState {
  return {
    region: {
      enabled: false,
      selectedRegionIds: [],
      selectedRegionNames: [],
      enabledCountryNames: [],
    },
    country: {
      enabled: true,
      selectedCountryNames: ["Sudan"],
      includeAlternateCountries: false,
    },
    watchlist: { enabled: false, threshold: 50, engagementPhaseThreshold: 3 },
    uupg: {
      enabled: true,
      globalEngagementAnywhereEnabled: true,
      frontierGroupEnabled: true,
    },
    hotspots: { enabled: false, metric: "unique_uupgs", countryCount: 10 },
    sorting: [{ id: "pg_population", desc: true }],
  };
}

describe("private data chat current-view handoff", () => {
  it("translates Sudan+UUPG into typed filters and a visible null-preserving quick reference", () => {
    const draft = buildPrivateDataChatViewContextDraft({ datasetId, filters: filters() });
    expect(draft).toMatchObject({
      filters: [{ field: "country", operator: "eq", value: "Sudan" }],
      namedFilters: [
        {
          key: "uupg",
          options: {
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: true,
          },
        },
      ],
      sort: [{ field: "population", direction: "desc" }],
      summary: { chips: [{ label: "All People Groups" }, { label: "Sudan" }, { label: "UUPG" }] },
    });
    expect(draft.summary.uupgRationale).toMatch(/false exclusion/iu);
    expect(JSON.stringify(draft)).not.toContain("Baseline UUPG");
  });

  it("signs only semantic state, never a client-authoritative count", () => {
    const draft = buildPrivateDataChatViewContextDraft({ datasetId, filters: filters() });
    const token = createPrivateDataChatViewContextToken({
      ownerId: "owner-1",
      conversationId,
      datasetId,
      datasetVersionCreatedAt: versionCreatedAt,
      ...draft,
      key,
      now: 1_000,
    });
    const state = verifyPrivateDataChatViewContextToken({
      token,
      ownerId: "owner-1",
      conversationId,
      key,
      now: 2_000,
      currentDataset: { id: datasetId, versionCreatedAt },
    });
    expect(state.filters).toEqual(draft.filters);
    expect(JSON.stringify(state)).not.toMatch(/recordCount|rowCount|matchingCount/iu);
  });

  it.each([
    ["cross user", { ownerId: "owner-2" }],
    ["cross conversation", { conversationId: "30000000-0000-4000-8000-000000000003" }],
    ["stale dataset", { currentDataset: { id: datasetId, versionCreatedAt: "2026-09-01T00:00:00.000Z" } }],
    ["expired", { now: 2_000_000 }],
  ])("rejects %s context", (_label, override) => {
    const draft = buildPrivateDataChatViewContextDraft({ datasetId, filters: filters() });
    const token = createPrivateDataChatViewContextToken({
      ownerId: "owner-1",
      conversationId,
      datasetId,
      datasetVersionCreatedAt: versionCreatedAt,
      ...draft,
      key,
      now: 1_000,
    });
    expect(() =>
      verifyPrivateDataChatViewContextToken({
        token,
        ownerId: "owner-1",
        conversationId,
        key,
        now: 2_000,
        currentDataset: { id: datasetId, versionCreatedAt },
        ...override,
      }),
    ).toThrow(/invalid, expired, or stale/iu);
  });

  it("rejects active filter modes the typed chat projection cannot reproduce", () => {
    const next = filters();
    next.watchlist.enabled = true;
    expect(() =>
      buildPrivateDataChatViewContextDraft({ datasetId, filters: next }),
    ).toThrow(/Watchlist filter is not yet available/iu);
  });
});
