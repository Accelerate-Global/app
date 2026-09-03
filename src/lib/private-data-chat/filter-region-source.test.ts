import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildPrivateDataChatFilterRegionSource,
  calculatePrivateDataChatFilterRegionSourceChecksum,
} from "@/lib/private-data-chat/filter-region-source";

describe("private data chat filter-region source", () => {
  it("builds one stable ordered source and checksum from region/country rows", () => {
    const input = {
      regions: [
        {
          id: "region-south-asia",
          name: "Asia, South",
          description: "Reviewed South Asia scope.",
          sortOrder: 8,
          updatedAt: new Date("2026-08-31T00:00:00.000Z"),
        },
        {
          id: "region-global",
          name: "Global",
          description: "All countries",
          sortOrder: 1,
          updatedAt: new Date("2026-08-30T00:00:00.000Z"),
        },
      ],
      countries: [
        { regionId: "region-south-asia", countryName: "Nepal" },
        { regionId: "region-global", countryName: "Nepal" },
        { regionId: "region-south-asia", countryName: "India" },
        { regionId: "region-global", countryName: "India" },
      ],
    };

    const source = buildPrivateDataChatFilterRegionSource(input);

    expect(source.checksum).toBe(
      calculatePrivateDataChatFilterRegionSourceChecksum(input),
    );
    expect(source.regions).toEqual([
      expect.objectContaining({
        name: "Global",
        countries: ["India", "Nepal"],
      }),
      expect.objectContaining({
        name: "Asia, South",
        countries: ["India", "Nepal"],
      }),
    ]);
    expect(
      buildPrivateDataChatFilterRegionSource({
        regions: [...input.regions].reverse(),
        countries: [...input.countries].reverse(),
      }).checksum,
    ).toBe(source.checksum);

    const historicallyOrderedRows = {
      regions: [input.regions[1]!, input.regions[0]!],
      countries: [...input.countries].sort(
        (left, right) =>
          left.regionId.localeCompare(right.regionId) ||
          left.countryName.localeCompare(right.countryName),
      ),
    };
    expect(source.checksum).toBe(
      createHash("sha256")
        .update(JSON.stringify(historicallyOrderedRows))
        .digest("hex"),
    );
  });
});
