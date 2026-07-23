import { describe, expect, it } from "vitest";

import { createDatasetFormingInputFingerprint } from "./fingerprint";
import type { DatasetFormingResourceBinding } from "./types";

const catalogBinding: DatasetFormingResourceBinding = {
  position: 0,
  key: "countries",
  bindingType: "catalog",
  required: true,
  kind: "country-geography",
  schemaVersion: 1,
  version: "2",
  checksum: "c".repeat(64),
  resourceSetId: "set-1",
  resourceSetChecksum: "d".repeat(64),
  resourceId: "country-resource",
  resourceVersionId: "country-version-2",
};

const codeBinding: DatasetFormingResourceBinding = {
  position: 1,
  key: "field-contract",
  bindingType: "code",
  required: true,
  kind: "field-contract",
  schemaVersion: 1,
  version: "1",
  checksum: "e".repeat(64),
  resourceSetId: null,
  resourceSetChecksum: null,
  resourceId: null,
  resourceVersionId: null,
};

function fingerprint(
  resourceBindings: DatasetFormingResourceBinding[],
  expectedCurrentPublicationId: string | null = null,
) {
  return createDatasetFormingInputFingerprint({
    sourceProfileKey: "source-profile",
    sourceRowsChecksum: "a".repeat(64),
    sourceRawChecksum: "b".repeat(64),
    engineKey: "engine",
    engineVersion: "engine-v1",
    engineChecksum: "f".repeat(64),
    artifactSchemaVersion: 1,
    resourceSetId: "set-1",
    resourceSetChecksum: "d".repeat(64),
    resourceBindings,
    expectedCurrentPublicationId,
  });
}

describe("dataset forming input fingerprint", () => {
  it("is deterministic even when callers supply bindings out of order", () => {
    expect(fingerprint([catalogBinding, codeBinding])).toBe(
      fingerprint([codeBinding, catalogBinding]),
    );
  });

  it("changes when a pinned dependency changes", () => {
    expect(fingerprint([catalogBinding, codeBinding])).not.toBe(
      fingerprint([
        catalogBinding,
        { ...codeBinding, checksum: "0".repeat(64) },
      ]),
    );
  });

  it("changes when the launch-pinned prior publication changes", () => {
    expect(fingerprint([catalogBinding, codeBinding], null)).not.toBe(
      fingerprint(
        [catalogBinding, codeBinding],
        "11111111-1111-4111-8111-111111111111",
      ),
    );
  });
});
