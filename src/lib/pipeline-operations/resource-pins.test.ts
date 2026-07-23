import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/db", () => ({ getDb: getDbMock }));

import {
  assertPinnedReferenceResourceSnapshot,
} from "./resource-pins";

const resourceSetId = "10000000-0000-4000-8000-000000000001";
const countryVersionId = "10000000-0000-4000-8000-000000000002";
const ropVersionId = "10000000-0000-4000-8000-000000000003";

function input(overrides: Record<string, unknown> = {}) {
  return {
    resourceSetId,
    resourceSetChecksum: "a".repeat(64),
    referenceVersionBindings: {
      "country-territory-codes": {
        resourceKey: "country-territory-codes",
        versionId: countryVersionId,
        checksum: "b".repeat(64),
        versionNumber: 2,
        schemaVersion: 1,
      },
      "rop-codes": {
        resourceKey: "rop-codes",
        versionId: ropVersionId,
        checksum: "c".repeat(64),
        versionNumber: 3,
        schemaVersion: 1,
      },
    },
    ...overrides,
  };
}

const retainedRows = [{
  resource_set_checksum: "a".repeat(64),
  resource_key: "country-territory-codes",
  version_id: countryVersionId,
  version_checksum: "b".repeat(64),
  version_number: 2,
  schema_version: 1,
}, {
  resource_set_checksum: "a".repeat(64),
  resource_key: "rop-codes",
  version_id: ropVersionId,
  version_checksum: "c".repeat(64),
  version_number: 3,
  schema_version: 1,
}];

describe("pipeline exact reference snapshot validation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects a forged set checksum and a partial member map", async () => {
    getDbMock.mockReturnValue({
      execute: vi.fn(async () => retainedRows),
    });
    await expect(assertPinnedReferenceResourceSnapshot(input({
      resourceSetChecksum: "f".repeat(64),
    }))).rejects.toMatchObject({
      code: "backfill-resource-checksum-mismatch",
    });
    await expect(assertPinnedReferenceResourceSnapshot(input({
      referenceVersionBindings: {
        "country-territory-codes":
          input().referenceVersionBindings["country-territory-codes"],
      },
    }))).rejects.toMatchObject({
      code: "backfill-resource-members-mismatch",
    });
  });

  it("loads the selected historical set directly even if another set is now current", async () => {
    const statements: string[] = [];
    getDbMock.mockReturnValue({
      execute: vi.fn(async (statement: unknown) => {
        statements.push(
          new PgDialect().sqlToQuery(statement as never).sql,
        );
        return retainedRows;
      }),
    });

    await expect(assertPinnedReferenceResourceSnapshot(input())).resolves
      .toMatchObject({
        resourceSetId,
        resourceSetChecksum: "a".repeat(64),
      });
    expect(statements[0]).toContain("where resource_set.id = $1::uuid");
    expect(statements[0]).not.toContain("sequence_number desc");
  });
});
