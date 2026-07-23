import { describe, expect, it } from "vitest";

import { normalizeHeaders } from "@/lib/csv";

import {
  AGGREGATE2_UNION_DESCRIPTION,
  buildAggregate2Candidate,
  buildTier2ReleaseCandidate,
  getAggregate2OutOfDateState,
} from "./releases";
import type { Tier2PartnerPublication } from "./types";

const columns = normalizeHeaders([
  "PG_AX_unique_PG_ID_PGIC",
  "PG_Name_Main",
]);

function row(pgic: string, name: string) {
  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      column.label === "PG_AX_unique_PG_ID_PGIC" ? pgic : name,
    ]),
  );
}

function publication(
  profileKey: string,
  publicationId: string,
  pgic: string,
): Tier2PartnerPublication {
  return {
    publicationId,
    profileKey,
    partnerKey: profileKey.replace("partner-", ""),
    registryRevisionId: "revision-1",
    outputChecksum: publicationId.padEnd(64, "0").slice(0, 64),
    publishedAt: "2026-07-22T00:00:00.000Z",
    columns,
    rows: [row(pgic, profileKey)],
  };
}

const definition = {
  key: "tier2-2026",
  version: "1",
  requiredProfileKeys: ["partner-alpha", "partner-beta"],
} as const;

describe("Tier 2 release products", () => {
  it("uses the approved combined-release display name", () => {
    expect(AGGREGATE2_UNION_DESCRIPTION).toBe("Aggregate 2 Combined Release");
  });

  it("enforces exact membership and is invariant to selection permutation", () => {
    const alpha = publication("partner-alpha", "pub-alpha", "PGIC-1");
    const beta = publication("partner-beta", "pub-beta", "PGIC-2");
    const first = buildTier2ReleaseCandidate({
      definition,
      publications: [alpha, beta],
    });
    const permuted = buildTier2ReleaseCandidate({
      definition,
      publications: [beta, alpha],
    });

    expect(first.valid).toBe(true);
    expect(first.memberPublicationIds).toEqual(["pub-alpha", "pub-beta"]);
    expect(permuted.outputChecksum).toBe(first.outputChecksum);
    expect(permuted.inputFingerprint).toBe(first.inputFingerprint);
    expect(permuted.rows).toEqual(first.rows);
  });

  it("identifies missing, duplicate, and unexpected members", () => {
    const candidate = buildTier2ReleaseCandidate({
      definition,
      publications: [
        publication("partner-alpha", "pub-a1", "PGIC-1"),
        publication("partner-alpha", "pub-a2", "PGIC-2"),
        publication("partner-other", "pub-o", "PGIC-3"),
      ],
    });

    expect(candidate.valid).toBe(false);
    expect(candidate.findings.map((entry) => entry.ruleCode)).toEqual([
      "duplicate-partner-publication",
      "missing-required-partner",
      "unexpected-partner-publication",
    ]);
  });

  it("preserves duplicate canonical rows and makes them blocking", () => {
    const candidate = buildTier2ReleaseCandidate({
      definition,
      publications: [
        publication("partner-alpha", "pub-alpha", "PGIC-1"),
        publication("partner-beta", "pub-beta", "PGIC-1"),
      ],
    });

    expect(candidate.rows).toHaveLength(2);
    expect(candidate.valid).toBe(false);
    expect(
      candidate.findings.filter(
        (entry) => entry.ruleCode === "duplicate-canonical-identity",
      ),
    ).toHaveLength(2);
  });

  it("accepts the AX_PGIC field emitted by identity publications", () => {
    const identityColumns = normalizeHeaders(["AX_PGIC", "PG_Name_Main"]);
    const candidate = buildTier2ReleaseCandidate({
      definition: {
        key: "tier2-2026",
        version: "1",
        requiredProfileKeys: ["partner-alpha"],
      },
      publications: [{
        ...publication("partner-alpha", "pub-alpha", "unused"),
        columns: identityColumns,
        rows: [{
          [identityColumns[0]!.key]: "10-jp-100001-LAO",
          [identityColumns[1]!.key]: "Alpha",
        }],
      }],
    });

    expect(candidate.valid).toBe(true);
    expect(candidate.findings).toHaveLength(0);
  });

  it("binds exact Tier 2/IMB/JP publications and reports stale inputs without mutation", () => {
    const snapshot = (publicationId: string, pgic: string) => ({
      publicationId,
      outputChecksum: publicationId.padEnd(64, "0").slice(0, 64),
      columns,
      rows: [row(pgic, publicationId)],
    });
    const candidate = buildAggregate2Candidate({
      tier2: snapshot("tier2-v1", "PGIC-1"),
      imb: snapshot("imb-v4", "PGIC-2"),
      jp: snapshot("jp-v7", "PGIC-3"),
    });
    const originalChecksum = candidate.outputChecksum;
    const stale = getAggregate2OutOfDateState({
      candidate,
      currentPublicationIds: {
        tier2: "tier2-v1",
        imb: "imb-v5",
        jp: "jp-v7",
      },
    });

    expect(candidate.valid).toBe(true);
    expect(candidate.exactPublicationIds).toEqual({
      tier2: "tier2-v1",
      imb: "imb-v4",
      jp: "jp-v7",
    });
    expect(stale).toEqual({ outOfDate: true, changedInputs: ["imb"] });
    expect(candidate.outputChecksum).toBe(originalChecksum);
  });
});
