import { describe, expect, it } from "vitest";

import {
  AX_IDENTITY_RULES_CHECKSUM,
  AX_IDENTITY_SEMANTIC_CONTRACT,
  checksumAxIdentitySemanticContract,
} from "@/lib/identity-registry/semantic-contract";
import { AX_IDENTITY_RULES_VERSION } from "@/lib/identity-registry/types";

import {
  checksumPipelineFlowDefinition,
  getPipelineFlowDefinition,
  listPipelineFlowDefinitions,
  requirePipelineFlowDefinition,
} from "./registry";

describe("pipeline operations registry", () => {
  it("registers every Tier 1 source plus Tier 1 and Tier 2 product flows", () => {
    const keys = listPipelineFlowDefinitions().map((definition) => definition.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "source-imb-people-groups",
        "source-etnopedia-people-groups",
        "source-joshua-project-pgic",
        "source-wcd-people-groups",
        "source-accelerate-owned-people-groups",
        "tier1-release",
        "tier1-full",
        "tier2-partner",
        "tier2-release",
      ]),
    );
  });

  it("pins deterministic checksums and explicit review gates", () => {
    for (const definition of listPipelineFlowDefinitions()) {
      expect(definition.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(definition.stages.length).toBeGreaterThan(0);
      expect(new Set(definition.stages.map((stage) => stage.key)).size).toBe(
        definition.stages.length,
      );
    }
    expect(
      requirePipelineFlowDefinition("tier1-full").stages.some(
        (stage) => stage.kind === "review" && stage.effectKey === "manual-review",
      ),
    ).toBe(true);
    expect(requirePipelineFlowDefinition("tier1-release").checksum).toBe(
      "fbd3f95e6d447c6247fa81c10b9dea3e7bb33713afbea697607301f4da165461",
    );
    expect(requirePipelineFlowDefinition("tier1-full").checksum).toBe(
      "ed02e57d097330f5ff8dff06ed24be7c064edd88bb9ed6289656595790e5a794",
    );
  });

  it("builds release candidates before review and finalizes only after approval", () => {
    for (const key of ["tier1-release", "tier1-full"] as const) {
      const stages = requirePipelineFlowDefinition(key).stages;
      expect(stages.findIndex((stage) => stage.key === "tier1-release-set"))
        .toBeLessThan(
          stages.findIndex((stage) => stage.key === "tier1-release-review"),
        );
      expect(stages.findIndex((stage) => stage.key === "tier1-release-review"))
        .toBeLessThan(
          stages.findIndex((stage) => stage.key === "tier1-release-finalize"),
        );
    }

    const tier2Stages = requirePipelineFlowDefinition("tier2-release").stages;
    expect(tier2Stages.findIndex((stage) => stage.key === "tier2-release-set"))
      .toBeLessThan(
        tier2Stages.findIndex((stage) => stage.key === "tier2-release-review"),
      );
    expect(tier2Stages.findIndex((stage) => stage.key === "tier2-release-review"))
      .toBeLessThan(
        tier2Stages.findIndex((stage) => stage.key === "tier2-merge"),
      );
  });

  it("propagates product semantic checksum changes into composite flow checksums", () => {
    const definition = requirePipelineFlowDefinition("tier1-full");
    const { checksum: _checksum, ...semanticDefinition } = definition;
    void _checksum;
    const changedDependencies = definition.semanticDependencies.map((dependency) =>
      dependency.kind === "product-definition" && dependency.key === "aggregate1-hotspots"
        ? { ...dependency, checksum: "f".repeat(64) }
        : dependency,
    );
    expect(checksumPipelineFlowDefinition({
      ...semanticDefinition,
      semanticDependencies: changedDependencies,
    })).not.toBe(definition.checksum);
  });

  it("includes source engines, code contracts, and product definitions in flow semantics", () => {
    const source = requirePipelineFlowDefinition("source-wcd-people-groups");
    expect(source.semanticDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "source-engine", key: "wcd" }),
        expect.objectContaining({ kind: "field-contract" }),
        expect.objectContaining({ kind: "transformation-contract" }),
      ]),
    );
    const complete = requirePipelineFlowDefinition("tier1-full");
    expect(complete.semanticDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "product-definition",
          key: "aggregate1-pgac",
        }),
        expect.objectContaining({ kind: "source-engine", key: "imb" }),
        {
          kind: "transformation-contract",
          key: "ax-identity-rules",
          version: AX_IDENTITY_RULES_VERSION,
          checksum: AX_IDENTITY_RULES_CHECKSUM,
        },
      ]),
    );
    const tier2Partner = requirePipelineFlowDefinition("tier2-partner");
    expect(tier2Partner.semanticDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "source-engine",
          key: "tier2-partner-forming",
        }),
        expect.objectContaining({
          kind: "transformation-contract",
          key: "tier2-partner-identity",
        }),
      ]),
    );
  });

  it("invalidates the complete Tier 1 flow when any AX identity branch contract changes", () => {
    const definition = requirePipelineFlowDefinition("tier1-full");
    const { checksum: _checksum, ...semanticDefinition } = definition;
    void _checksum;
    for (const changedBranch of AX_IDENTITY_SEMANTIC_CONTRACT.branches) {
      const changedRulesChecksum = checksumAxIdentitySemanticContract({
        ...AX_IDENTITY_SEMANTIC_CONTRACT,
        branches: AX_IDENTITY_SEMANTIC_CONTRACT.branches.map((branch) =>
          branch.key === changedBranch.key
            ? { ...branch, outcome: `${branch.outcome} [changed]` }
            : branch
        ),
      });
      const changedDependencies = definition.semanticDependencies.map(
        (dependency) => dependency.key === "ax-identity-rules"
          ? { ...dependency, checksum: changedRulesChecksum }
          : dependency,
      );
      expect(
        checksumPipelineFlowDefinition({
          ...semanticDefinition,
          semanticDependencies: changedDependencies,
        }),
        changedBranch.key,
      ).not.toBe(definition.checksum);
    }
  });

  it("invalidates the Tier 2 partner flow when its forming or identity contract changes", () => {
    const definition = requirePipelineFlowDefinition("tier2-partner");
    const { checksum: _checksum, ...semanticDefinition } = definition;
    void _checksum;
    for (const key of [
      "tier2-partner-forming",
      "tier2-partner-identity",
    ]) {
      const changedDependencies = definition.semanticDependencies.map(
        (dependency) => dependency.key === key
          ? { ...dependency, checksum: "f".repeat(64) }
          : dependency,
      );
      expect(checksumPipelineFlowDefinition({
        ...semanticDefinition,
        semanticDependencies: changedDependencies,
      })).not.toBe(definition.checksum);
    }
  });

  it("uses a fixed semantic checksum and invalidates it when a code contract changes", () => {
    const definition = requirePipelineFlowDefinition("source-wcd-people-groups");
    expect(definition.checksum).toBe(
      "a0525ee8d1180ac1210e60be58086a366cbcd82af12b517e3f66c8811618c6cf",
    );
    const changed = {
      ...definition,
      semanticDependencies: definition.semanticDependencies.map((dependency) =>
        dependency.kind === "field-contract"
          ? { ...dependency, checksum: "f".repeat(64) }
          : dependency,
      ),
    };
    expect(checksumPipelineFlowDefinition(changed)).not.toBe(
      definition.checksum,
    );
  });

  it("fails closed for unknown definitions", () => {
    expect(getPipelineFlowDefinition("unknown")).toBeNull();
    expect(() => requirePipelineFlowDefinition("unknown")).toThrow(
      "Unknown pipeline flow definition",
    );
  });
});
