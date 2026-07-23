import { describe, expect, it } from "vitest";

import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import {
  createTier2ProductInputFingerprint,
  TIER2_PRODUCT_DEFINITIONS,
} from "./definitions";

describe("Tier 2 product definition contracts", () => {
  it("uses stable semantic checksums instead of placeholder values", () => {
    expect(TIER2_PRODUCT_DEFINITIONS.tier2.checksum).toBe(
      "1641ad4635a3a7dc4b18102538bef5f046caecd51348fa9a1145f0324a3fd315",
    );
    expect(TIER2_PRODUCT_DEFINITIONS.aggregate2.checksum).toBe(
      "278dee49fd8a6a4b678b24bbb5c97350a479a05d042d8c175d4870d00f9a0be9",
    );
    for (const definition of Object.values(TIER2_PRODUCT_DEFINITIONS)) {
      const { checksum, ...contract } = definition;
      expect(checksum).toBe(checksumSourceFormingValue(contract));
      expect(checksum).not.toMatch(/^(.)\1{63}$/u);
      expect(definition.isWorkspaceVisible).toBe(true);
    }
  });

  it("pins the approved Aggregate 2 identity and exact input order", () => {
    expect(TIER2_PRODUCT_DEFINITIONS.aggregate2).toMatchObject({
      definitionKey: "aggregate2-exact-union",
      displayName: "Aggregate 2 Combined Release",
      requiredInputKeys: ["tier2", "imb", "jp"],
    });
  });

  it("includes resource, registry, and DB/code definition bindings in reuse identity", () => {
    const baseline = {
      candidateFingerprint: "a".repeat(64),
      resourceSetId: "resource-set-1",
      resourceSetChecksum: "b".repeat(64),
      registryRevisionId: "revision-1",
      registryRevisionChecksum: "c".repeat(64),
      databaseDefinitionChecksum: TIER2_PRODUCT_DEFINITIONS.tier2.checksum,
      codeDefinitionChecksum: TIER2_PRODUCT_DEFINITIONS.tier2.checksum,
      expectedCurrentPublicationId: null,
    };
    const fingerprint = createTier2ProductInputFingerprint(baseline);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(createTier2ProductInputFingerprint({
      ...baseline,
      registryRevisionChecksum: "d".repeat(64),
    })).not.toBe(fingerprint);
    expect(createTier2ProductInputFingerprint({
      ...baseline,
      resourceSetChecksum: "e".repeat(64),
    })).not.toBe(fingerprint);
    expect(createTier2ProductInputFingerprint({
      ...baseline,
      expectedCurrentPublicationId: "publication-2",
    })).not.toBe(fingerprint);
  });
});
