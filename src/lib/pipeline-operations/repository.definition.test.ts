import { describe, expect, it } from "vitest";

import {
  AX_IDENTITY_SEMANTIC_CONTRACT,
  checksumAxIdentitySemanticContract,
} from "@/lib/identity-registry/semantic-contract";

import { isPipelineOperationError } from "./errors";
import {
  assertPipelineDefinitionCurrent,
  isPipelineDefinitionCurrent,
  snapshotPipelineRunInputs,
} from "./repository";
import {
  checksumPipelineFlowDefinition,
  requirePipelineFlowDefinition,
} from "./registry";

describe("pipeline definition drift", () => {
  it("allows the current composite definition pin", () => {
    const definition = requirePipelineFlowDefinition("source-wcd-people-groups");
    expect(
      isPipelineDefinitionCurrent({
        definitionKey: definition.key,
        definitionVersion: definition.version,
        definitionChecksum: definition.checksum,
      }),
    ).toBe(true);
  });

  it("prevents a reviewed run from resuming after contract semantics drift", () => {
    let error: unknown;
    try {
      assertPipelineDefinitionCurrent({
        definitionKey: "source-wcd-people-groups",
        definitionVersion: "pipeline-operations-v1",
        definitionChecksum: "0".repeat(64),
      });
    } catch (caught) {
      error = caught;
    }
    expect(isPipelineOperationError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 409,
      code: "pipeline-definition-stale",
    });
  });

  it("includes semantic dependencies in the immutable exact-input fingerprint", () => {
    const definition = requirePipelineFlowDefinition("source-wcd-people-groups");
    const baseline = snapshotPipelineRunInputs({
      definition,
      exactInputs: { resourceSetId: "resource-set-1" },
    });
    const changed = snapshotPipelineRunInputs({
      definition: {
        ...definition,
        semanticDependencies: definition.semanticDependencies.map((dependency) =>
          dependency.kind === "field-contract"
            ? { ...dependency, checksum: "f".repeat(64) }
            : dependency,
        ),
      },
      exactInputs: { resourceSetId: "resource-set-1" },
    });
    expect(baseline.exactInputs).toMatchObject({
      pipelineDefinition: {
        semanticDependencies: definition.semanticDependencies,
      },
    });
    expect(changed.inputFingerprint).not.toBe(baseline.inputFingerprint);
  });

  it("rejects an old complete Tier 1 pin after AX identity rules drift", () => {
    const definition = requirePipelineFlowDefinition("tier1-full");
    const existingBindingBranch = AX_IDENTITY_SEMANTIC_CONTRACT.branches.find(
      (branch) => branch.key === "existing-binding-reuse",
    )!;
    const changedRulesChecksum = checksumAxIdentitySemanticContract({
      ...AX_IDENTITY_SEMANTIC_CONTRACT,
      branches: AX_IDENTITY_SEMANTIC_CONTRACT.branches.map((branch) =>
        branch.key === existingBindingBranch.key
          ? { ...branch, outcome: `${branch.outcome} [changed]` }
          : branch
      ),
    });
    const changedDependencies = definition.semanticDependencies.map(
      (dependency) => dependency.key === "ax-identity-rules"
        ? { ...dependency, checksum: changedRulesChecksum }
        : dependency,
    );
    const { checksum: _checksum, ...semanticDefinition } = definition;
    void _checksum;
    const oldChecksum = checksumPipelineFlowDefinition({
      ...semanticDefinition,
      semanticDependencies: changedDependencies,
    });
    const currentSnapshot = snapshotPipelineRunInputs({
      definition,
      exactInputs: { resourceSetId: "resource-set-1" },
    });
    const oldSnapshot = snapshotPipelineRunInputs({
      definition: {
        ...definition,
        checksum: oldChecksum,
        semanticDependencies: changedDependencies,
      },
      exactInputs: { resourceSetId: "resource-set-1" },
    });

    expect(oldChecksum).not.toBe(definition.checksum);
    expect(oldSnapshot.inputFingerprint).not.toBe(
      currentSnapshot.inputFingerprint,
    );
    expect(isPipelineDefinitionCurrent({
      definitionKey: definition.key,
      definitionVersion: definition.version,
      definitionChecksum: oldChecksum,
    })).toBe(false);
    expect(() => assertPipelineDefinitionCurrent({
      definitionKey: definition.key,
      definitionVersion: definition.version,
      definitionChecksum: oldChecksum,
    })).toThrow("older pipeline definition");
  });
});
