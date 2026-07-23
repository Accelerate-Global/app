import { describe, expect, it } from "vitest";

import sourceAliasesFixture from "./fixtures/source-aliases.sanitized.json";
import { preparePipelineResource } from "./pipeline-adapters";
import { SOURCE_ALIASES_RESOURCE_KEY } from "./pipeline-types";
import {
  PinnedPipelineResourceError,
  validatePinnedPipelineResourceRecord,
  type PinnedPipelineResourceRecord,
} from "./pinned-runtime";

const setId = "10000000-0000-4000-8000-000000000001";
const setChecksum = "a".repeat(64);
const prepared = preparePipelineResource(
  SOURCE_ALIASES_RESOURCE_KEY,
  sourceAliasesFixture,
);

function record(
  overrides: Partial<PinnedPipelineResourceRecord> = {},
): PinnedPipelineResourceRecord {
  return {
    resourceSetId: setId,
    resourceSetChecksum: setChecksum,
    resourceId: "20000000-0000-4000-8000-000000000001",
    resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
    resourceKind: "source-registry",
    versionId: "30000000-0000-4000-8000-000000000001",
    versionNumber: 4,
    schemaVersion: 1,
    lifecycleState: "valid",
    contentChecksum: prepared.contentChecksum,
    normalizedResource: sourceAliasesFixture,
    entryCount: prepared.entryCount,
    ...overrides,
  };
}

function expectPinnedError(
  action: () => unknown,
  code: PinnedPipelineResourceError["code"],
) {
  try {
    action();
    throw new Error("Expected a pinned pipeline resource error.");
  } catch (error) {
    expect(error).toBeInstanceOf(PinnedPipelineResourceError);
    expect((error as PinnedPipelineResourceError).code).toBe(code);
  }
}

describe("pinned pipeline reference resources", () => {
  it("returns a typed immutable package only for the exact set and checksum", () => {
    const result = validatePinnedPipelineResourceRecord({
      record: record(),
      resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
      resourceSetId: setId,
      resourceSetChecksum: setChecksum,
      expectedVersionId: "30000000-0000-4000-8000-000000000001",
      expectedContentChecksum: prepared.contentChecksum,
    });

    expect(result.binding).toMatchObject({
      resourceSetId: setId,
      resourceSetChecksum: setChecksum,
      resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
      versionNumber: 4,
    });
    expect(result.resource.entries).toHaveLength(2);
    expect(Object.isFrozen(result.resource)).toBe(true);
  });

  it.each([
    {
      label: "set checksum",
      input: { resourceSetChecksum: "b".repeat(64) },
      code: "resource-set-checksum-mismatch",
    },
    {
      label: "version ID",
      input: { expectedVersionId: "30000000-0000-4000-8000-000000000099" },
      code: "resource-version-mismatch",
    },
    {
      label: "content checksum",
      input: { expectedContentChecksum: "c".repeat(64) },
      code: "resource-checksum-mismatch",
    },
  ])("fails closed when the pinned $label changes", ({ input, code }) => {
    expectPinnedError(() =>
      validatePinnedPipelineResourceRecord({
        record: record(),
        resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
        resourceSetId: setId,
        resourceSetChecksum: setChecksum,
        ...input,
      }), code as PinnedPipelineResourceError["code"]);
  });

  it("rejects payload or retained-row drift even when a database row is present", () => {
    const changedPayload = {
      ...sourceAliasesFixture,
      entries: sourceAliasesFixture.entries.slice(0, 1),
    };
    expectPinnedError(() =>
      validatePinnedPipelineResourceRecord({
        record: record({ normalizedResource: changedPayload }),
        resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
        resourceSetId: setId,
        resourceSetChecksum: setChecksum,
      }), "resource-checksum-mismatch");

    expectPinnedError(() =>
      validatePinnedPipelineResourceRecord({
        record: record({ entryCount: 99 }),
        resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
        resourceSetId: setId,
        resourceSetChecksum: setChecksum,
      }), "projection-count-mismatch");
  });

  it("never substitutes a latest resource when the set member is missing", () => {
    expectPinnedError(() =>
      validatePinnedPipelineResourceRecord({
        record: null,
        resourceKey: SOURCE_ALIASES_RESOURCE_KEY,
        resourceSetId: setId,
        resourceSetChecksum: setChecksum,
      }), "missing-resource-binding");
  });
});
