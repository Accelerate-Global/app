import { describe, expect, it, vi } from "vitest";

import { buildPrivateDataChatSemanticContextPackage } from "@/lib/private-data-chat/semantic-context";
import { buildPrivateDataChatAdditionalSourceVersions } from "@/lib/private-data-chat/semantic-context-candidate";

describe("private data chat semantic context candidate inputs", () => {
  it("uses the shared filter-region checksum without rehashing it", () => {
    const filterRegionChecksum = "f".repeat(64);
    expect(
      buildPrivateDataChatAdditionalSourceVersions({
        fieldSourceMappings: [{ canonicalKey: "geo_country_name" }],
        filterRegionChecksum,
      }),
    ).toMatchObject({
      fieldSourceMappings: expect.stringMatching(/^[0-9a-f]{64}$/u),
      filterRegions: filterRegionChecksum,
      imbFieldContract: expect.stringMatching(/^\d+:[0-9a-f]{64}$/u),
    });
  });

  it("binds field definitions, source mappings, filter regions, contracts, and resources in one manifest", () => {
    const built = buildPrivateDataChatSemanticContextPackage({
      sourceRetrievedAt: "2026-08-31T12:00:00.000Z",
      fieldDefinitions: [
        {
          canonicalKey: "geo_country_name",
          label: "Country",
          definition: "Canonical country.",
          sourcePriorityKeys: ["imb", "jp"],
          updatedAt: "2026-08-31T10:00:00.000Z",
        },
      ],
      resourceSummaries: [
        {
          resourceKey: "rop-codes",
          label: "ROP Codes",
          description: "ROP hierarchy.",
          versionId: "10000000-0000-4000-8000-000000000001",
          versionNumber: 7,
          contentChecksum: "a".repeat(64),
          sourceRetrievedAt: "2026-08-30T00:00:00.000Z",
          entryCount: 13_069,
        },
      ],
      additionalSourceVersions: {
        fieldSourceMappings: "mapping-checksum",
        filterRegions: "region-checksum",
        imbFieldContract: "2:contract-checksum",
      },
    });

    expect(built.package.sourceVersionManifest).toMatchObject({
      "resource:rop-codes": expect.stringContaining(
        "10000000-0000-4000-8000-000000000001",
      ),
      fieldSourceMappings: "mapping-checksum",
      filterRegions: "region-checksum",
      imbFieldContract: "2:contract-checksum",
    });
    expect(
      built.package.sourceVersionManifest["fieldDefinition:geo_country_name"],
    ).toMatch(/^2026-08-31T10:00:00.000Z:[0-9a-f]{64}$/u);
    expect(vi.isMockFunction(buildPrivateDataChatSemanticContextPackage)).toBe(
      false,
    );
  });
});
