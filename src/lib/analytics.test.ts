import { describe, expect, it } from "vitest";

import {
  getAnalyticsEventPropertyKeys,
  getAnalyticsWorkspaceRole,
  getAnalyticsRouteFromPathname,
  getEnabledFilterSections,
  getSortingKeys,
  isAppAnalyticsEventName,
  isAppAnalyticsRoute,
  redactAnalyticsUrl,
} from "@/lib/analytics";

describe("analytics helpers", () => {
  it("redacts query params, hashes, and UUID path segments", () => {
    expect(
      redactAnalyticsUrl(
        "https://example.com/dashboard/datasets/8a3bade4-d4ac-43be-8fad-cd20412f2cf9?savedTableId=secret#token=abc",
      ),
    ).toBe("https://example.com/dashboard/datasets/[id]");
  });

  it("serializes enabled filter sections", () => {
    expect(
      getEnabledFilterSections({
        region: {
          enabled: true,
          selectedRegionIds: ["region-1"],
          selectedRegionNames: ["North Africa"],
          enabledCountryNames: ["Egypt"],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: true,
          thresholdEnabled: true,
          threshold: 2,
          engagementPhaseEnabled: true,
          engagementPhaseThreshold: 6,
          evangelicalPopulationBelieversRuleEnabled: true,
          evangelicalPopulationBelieversRule: {
            tiers: [
              {
                minPopulation: 0,
                maxPopulation: 4_999,
                minBelievers: 50,
              },
              {
                minPopulation: 5_000,
                maxPopulation: 10_000,
                minBelievers: 75,
              },
              {
                minPopulation: 10_001,
                maxPopulation: null,
                minBelievers: 100,
              },
            ],
          },
          frontierGroupEnabled: true,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        sorting: [],
      }),
    ).toBe("region|watchlist");
  });

  it("includes hotspots in enabled filter section serialization", () => {
    expect(
      getEnabledFilterSections({
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: false,
          selectedCountryNames: [],
        },
        watchlist: {
          enabled: false,
          thresholdEnabled: true,
          threshold: 2,
          engagementPhaseEnabled: true,
          engagementPhaseThreshold: 6,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        hotspots: {
          enabled: true,
          metric: "population",
          countryCount: 10,
        },
        sorting: [],
      }),
    ).toBe("hotspots");
  });

  it("serializes sorting keys for analytics payloads", () => {
    expect(
      getSortingKeys([
        { id: "country", desc: false },
        { id: "population", desc: true },
      ]),
    ).toBe("country:asc|population:desc");
  });

  it("maps pathname segments into analytics routes", () => {
    expect(getAnalyticsRouteFromPathname("/")).toBe("sign_in");
    expect(getAnalyticsRouteFromPathname("/dashboard/profile")).toBe("profile");
    expect(getAnalyticsRouteFromPathname("/dashboard/analytics")).toBe("analytics");
    expect(getAnalyticsRouteFromPathname("/dashboard/filter-settings")).toBe(
      "dashboard",
    );
    expect(
      getAnalyticsRouteFromPathname("/dashboard/datasets/123/edit"),
    ).toBe("dataset_edit");
    expect(
      getAnalyticsRouteFromPathname("/dashboard/field-sources"),
    ).toBe("field_sources");
  });

  it("reports canonical workspace roles for analytics", () => {
    expect(getAnalyticsWorkspaceRole("super_admin")).toBe("super_admin");
    expect(getAnalyticsWorkspaceRole("admin")).toBe("admin");
    expect(getAnalyticsWorkspaceRole("pro")).toBe("pro");
    expect(getAnalyticsWorkspaceRole("basic")).toBe("basic");
    expect(getAnalyticsWorkspaceRole(false)).toBe("pro");
  });

  it("exposes preload and cache analytics event property keys", () => {
    expect(getAnalyticsEventPropertyKeys("dataset_preload_completed")).toEqual([
      "source_dataset_id",
      "row_count",
      "load_duration_ms",
    ]);
    expect(getAnalyticsEventPropertyKeys("dataset_row_cache_hit")).toEqual([
      "dataset_source",
      "source_dataset_id",
      "cached_row_count",
    ]);
  });

  it("exposes hotspots analytics event property keys", () => {
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "hotspots_enabled",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "hotspots_metric",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "hotspots_country_count",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "watchlist_jp_only_evangelical_enabled",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "watchlist_jp_only_min_believers",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "watchlist_jp_only_max_believers",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "watchlist_jp_only_max_percent_evangelical",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "watchlist_engagement_phase_min",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "uupg_global_engagement_anywhere_enabled",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).toContain(
      "uupg_frontier_group_enabled",
    );
  });

  it("does not expose legacy frontier-group analytics event property keys", () => {
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).not.toContain(
      "watchlist_frontier_group_enabled",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).not.toContain(
      "watchlist_frontier_group_value",
    );
  });

  it("does not expose removed watchlist population-believers analytics keys", () => {
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).not.toContain(
      "watchlist_population_believers_rule_enabled",
    );
    expect(getAnalyticsEventPropertyKeys("dataset_filters_applied")).not.toContain(
      "watchlist_population_believers_rule_tier_count",
    );
  });

  it("does not recognize removed filter-settings analytics routes or events", () => {
    expect(isAppAnalyticsRoute("filter_settings")).toBe(false);
    expect(isAppAnalyticsEventName("filter_region_created")).toBe(false);
    expect(isAppAnalyticsEventName("filter_region_updated")).toBe(false);
    expect(isAppAnalyticsEventName("filter_region_deleted")).toBe(false);
  });

  it("does not recognize removed dataset preset analytics events", () => {
    expect(isAppAnalyticsEventName("dataset_open_preset_saved")).toBe(false);
    expect(isAppAnalyticsEventName("dataset_open_preset_cleared")).toBe(false);
    expect(isAppAnalyticsEventName("dataset_open_preset_used")).toBe(false);
  });

  it("does not recognize removed field source write analytics events", () => {
    expect(isAppAnalyticsEventName("field_source_value_saved")).toBe(false);
    expect(isAppAnalyticsEventName("field_source_type_created")).toBe(false);
  });

  it("exposes filtered dataset assignment analytics event property keys", () => {
    expect(getAnalyticsEventPropertyKeys("dataset_assigned")).toEqual([
      "source_dataset_id",
      "target_dataset_id",
      "assigned_row_count",
      "filter_sections_enabled",
      "sorting_count",
    ]);
  });

  it("exposes user management resend analytics event property keys", () => {
    expect(isAppAnalyticsEventName("admin_invite_resent")).toBe(true);
    expect(getAnalyticsEventPropertyKeys("admin_invite_resent")).toEqual([
      "to_status",
    ]);
  });
});
