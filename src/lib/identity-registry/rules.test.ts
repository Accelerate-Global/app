import { describe, expect, it } from "vitest";

import {
  AX_IDENTITY_RULES_CHECKSUM,
  AxIdentityRuleError,
  buildAxIdentityCodes,
  normalizeIso3,
  normalizeRop1,
  normalizeRop3,
  normalizeSixDigit,
  normalizeSourceInitials,
} from "./rules";
import { AX_IDENTITY_SEMANTIC_CONTRACT } from "./semantic-contract";

describe("AX identity rules", () => {
  it("builds deterministic ROP3 PGAC and PGIC values", () => {
    expect(
      buildAxIdentityCodes({
        source: "Joshua Project",
        rop1: "A010",
        sixDigit: "100001",
        sixDigitKind: "rop3",
        iso3: "lao",
        allowedRop3: new Set(["100001"]),
        allowedIso3: new Set(["LAO"]),
      }),
    ).toEqual({
      pgac: "10-jp-100001",
      pgic: "10-jp-100001-LAO",
      sixDigit: "100001",
    });
  });

  it("uses the documented 00 ROP1 component without inventing source or ISO fallbacks", () => {
    expect(
      buildAxIdentityCodes({
        source: "IMB",
        rop1: null,
        sixDigit: 0,
        iso3: "CIV",
      }),
    ).toMatchObject({ pgac: "00-im-000000", pgic: "00-im-000000-CIV" });
    expect(() => buildAxIdentityCodes({ source: "unknown", rop1: null, sixDigit: 1, iso3: "LAO" })).toThrow(AxIdentityRuleError);
    expect(() => buildAxIdentityCodes({ source: "IMB", rop1: null, sixDigit: 1, iso3: "" })).toThrow(AxIdentityRuleError);
  });

  it("uses one exact versioned source-alias binding for a partner", () => {
    expect(
      buildAxIdentityCodes({
        source: "partner-alpha",
        sourceAliasBinding: {
          sourceKey: "partner-alpha",
          initials: "pa",
        },
        rop1: "A010",
        sixDigit: "100001",
        sixDigitKind: "rop3",
        iso3: "LAO",
      }),
    ).toMatchObject({
      pgac: "10-pa-100001",
      pgic: "10-pa-100001-LAO",
    });
    expect(() =>
      normalizeSourceInitials("partner-beta", {
        sourceKey: "partner-alpha",
        initials: "pa",
      }),
    ).toThrowError(/does not match/u);
  });

  it("normalizes exact boundaries and rejects invalid components", () => {
    expect(normalizeSourceInitials("  ETNOPEDIA  ")).toBe("et");
    expect(normalizeRop1("")).toBeNull();
    expect(normalizeRop1("a013")).toBe("A013");
    expect(normalizeRop3("999999")).toBe("999999");
    expect(normalizeIso3("civ")).toBe("CIV");
    expect(normalizeSixDigit(999999)).toBe("999999");
    expect(() => normalizeRop1("A13")).toThrowError(/one letter and three digits/u);
    expect(() => normalizeRop3("100000", new Set(["100001"]))).toThrowError(/pinned/u);
    expect(() => normalizeIso3("XXX", new Set(["LAO"]))).toThrowError(/pinned/u);
    expect(() => normalizeSixDigit(1_000_000)).toThrowError(/out of range/u);
    expect(AX_IDENTITY_RULES_CHECKSUM).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("derives every built-in source mapping from the pinned semantic contract", () => {
    for (const [source, initials] of AX_IDENTITY_SEMANTIC_CONTRACT.sourceInitials) {
      expect(normalizeSourceInitials(source), source).toBe(initials);
    }
  });

  it("keeps distinct source and numeric components distinct at representative boundaries", () => {
    const codes = new Set<string>();
    for (const source of ["AX", "ETNO", "IMB", "JP", "WCD"]) {
      for (const number of [0, 1, 999_999]) {
        const result = buildAxIdentityCodes({ source, rop1: "A010", sixDigit: number, iso3: "LAO" });
        expect(codes.has(result.pgic)).toBe(false);
        codes.add(result.pgic);
      }
    }
  });
});
