import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  computePipelineCharacterization,
  verifyPipelineCharacterization,
} from "./pipeline-characterization";

describe("pipeline characterization", () => {
  it("matches the checked-in golden result deterministically", async () => {
    const first = await verifyPipelineCharacterization();
    const second = await verifyPipelineCharacterization();

    expect(second).toEqual(first);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("covers source, identity, merge, aggregate, and duplicate-conflict edges", async () => {
    const result = await computePipelineCharacterization();

    expect(result.source.rows.map((row) => row.caseId)).toEqual(expect.arrayContaining([
      "normal-row",
      "missing-identifier",
      "country-alias",
      "unknown-country",
      "rop3-absent",
      "duplicate-domain-a",
      "invalid-types",
      "schema-drift",
    ]));
    expect(result.identity.rows.map((row) => row.outcome)).toEqual(expect.arrayContaining([
      "rop3-derived",
      "ledger-reused",
      "uuid-minted",
      "blocked",
    ]));
    expect(result.merge.rows[0]?.provenance).toMatchObject({
      peopleName: "JP",
      population: "IMB",
      countryName: "JP",
    });
    expect(result.aggregate.aggregate1[0]).toMatchObject({
      population: 1000,
      percentChristian: 13,
      percentEvangelical: 2.9,
      joint: true,
    });
    expect(result.aggregate.tier2Conflicts).toHaveLength(1);
  });

  it("contains no provider, Drive, database, or secret access", async () => {
    const source = await readFile(new URL("./pipeline-characterization.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/fetch\s*\(/u);
    expect(source).not.toMatch(/process\.env/u);
    expect(source).not.toMatch(/supabase|googleapis|axios|\.\.\/data/u);
    expect(source).not.toMatch(/api[_-]?key|password|service[_-]?account/iu);
  });
});
