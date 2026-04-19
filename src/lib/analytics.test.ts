import { describe, expect, it } from "vitest";

import {
  getAnalyticsRouteFromPathname,
  getEnabledFilterSections,
  getSortingKeys,
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
    expect(
      getAnalyticsRouteFromPathname("/dashboard/datasets/123/edit"),
    ).toBe("dataset_edit");
    expect(
      getAnalyticsRouteFromPathname("/dashboard/field-sources"),
    ).toBe("field_sources");
  });
});
