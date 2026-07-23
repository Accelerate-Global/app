import { Buffer } from "node:buffer";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/datasets", () => ({ publishPreparedDataset: vi.fn() }));
vi.mock("./admin", async () => {
  const actual = await vi.importActual<typeof import("./admin")>("./admin");
  return {
    ...actual,
    listTier2PartnerProfiles: vi.fn(),
    listTier2StableTargets: vi.fn(),
  };
});
vi.mock("@/lib/pipeline-products/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products/storage")>(
    "@/lib/pipeline-products/storage",
  );
  return {
    ...actual,
    uploadPipelineArtifact: vi.fn(),
    readPipelineArtifact: vi.fn(),
    deletePipelineArtifacts: vi.fn(),
    uploadPipelineDatasetBlob: vi.fn(),
    deletePipelineDatasetBlob: vi.fn(),
  };
});

import { getDb } from "@/db";
import { publishPreparedDataset } from "@/lib/datasets";
import {
  deletePipelineDatasetBlob,
  readPipelineArtifact,
  uploadPipelineArtifact,
  uploadPipelineDatasetBlob,
} from "@/lib/pipeline-products/storage";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import {
  listTier2PartnerProfiles,
  listTier2StableTargets,
} from "./admin";
import { getTier2ProductDefinitionContract } from "./definitions";
import {
  assertTier2ProductCandidateTargetCurrent,
  assertTier2RollbackSnapshot,
  createTier2ProductRelease,
  finalizeTier2ProductReleaseCandidate,
  getTier2LegacyComparison,
  publishTier2ProductRun,
  rejectTier2ProductRun,
  rollbackTier2ProductTarget,
} from "./operations";

beforeEach(() => vi.clearAllMocks());

function sqlText(statement: unknown) {
  return new PgDialect().sqlToQuery(statement as never).sql;
}

const tier2RunRow = {
  id: "30000000-0000-4000-8000-000000000001",
  definition_key: "tier2-complete-partners",
  display_name: "Tier 2 provenance-preserving partner union",
  stage: "tier2-union",
  definition_version: "v1",
  definition_checksum: getTier2ProductDefinitionContract("tier2").checksum,
  release_set_id: "30000000-0000-4000-8000-000000000002",
  status: "valid",
  input_fingerprint: "b".repeat(64),
  input_row_count: 1,
  output_row_count: 1,
  warning_count: 0,
  error_count: 0,
  output_checksum: "c".repeat(64),
  validation_summary: {},
  artifact_manifest: {},
  dataset_id: null,
  publication_id: null,
  expected_current_publication_id: null,
  publication_target_key: "tier2-pgic",
  rejection_reason: null,
  publication_reason: null,
  created_at: "2026-07-23T00:00:00.000Z",
  completed_at: "2026-07-23T00:01:00.000Z",
  legacy_comparison_available: false,
};

describe("Tier 2 release review lifecycle", () => {
  it("retains a complete draft candidate without finalizing the release before review", async () => {
    const definition = getTier2ProductDefinitionContract("tier2");
    const publicationId = "30000000-0000-4000-8000-000000000003";
    const registryRevisionId = "30000000-0000-4000-8000-000000000004";
    const resourceSetId = "30000000-0000-4000-8000-000000000005";
    const launchPublicationId = "30000000-0000-4000-8000-000000000009";
    let returnedExpectedCurrentPublicationId: string | null =
      launchPublicationId;
    const statements: string[] = [];
    const execute = vi.fn(async (statement: unknown) => {
      const text = sqlText(statement);
      statements.push(text);
      if (
        text.includes("from private.pipeline_definitions") &&
        !text.includes("from private.pipeline_runs")
      ) {
        return [{
          definition_key: definition.definitionKey,
          stage: definition.stage,
          display_name: definition.displayName,
          version: definition.version,
          checksum: definition.checksum,
          publication_target_key: definition.publicationTargetKey,
          is_workspace_visible: definition.isWorkspaceVisible,
        }];
      }
      if (
        text.includes("from private.pipeline_publications") &&
        text.includes("where id in")
      ) {
        return [{
          id: publicationId,
          producer_kind: "identity",
          producer_run_id: "30000000-0000-4000-8000-000000000006",
          source_profile_key: "partner-a",
          registry_revision_id: registryRevisionId,
          output_checksum: "d".repeat(64),
          row_count: 1,
          publication_target_key: null,
          created_at: "2026-07-22T23:00:00.000Z",
        }];
      }
      if (text.includes("from private.pipeline_publication_rows")) {
        return [{ row_index: 0, data: { PGIC: "100001" } }];
      }
      if (text.includes("from private.reference_resource_sets")) {
        return [{
          resource_set_checksum: "e".repeat(64),
          registry_revision_checksum: "f".repeat(64),
        }];
      }
      if (text.includes("from private.tier2_publication_targets")) {
        if (text.includes("current_publication_id")) {
          throw new Error(
            "A coordinator-owned launch pin must not be replaced with the live target.",
          );
        }
        return [{ product_kind: "tier2" }];
      }
      if (
        text.includes("from private.ax_registry_revisions as revision") &&
        text.includes("group by revision.id")
      ) {
        return [{ revision_number: 2, binding_ids: [] }];
      }
      if (text.includes("with recursive publication_lineage")) {
        return [{
          publication_id: publicationId,
          origin_revision_number: 1,
          binding_ids: [],
        }];
      }
      if (
        text.includes("select id from private.pipeline_runs") &&
        text.includes("input_fingerprint")
      ) {
        return [];
      }
      if (
        text.includes("select output_checksum, row_count") &&
        text.includes("for share")
      ) {
        return [{ output_checksum: "d".repeat(64), row_count: 1 }];
      }
      if (text.includes("select private.finalize_tier2_release_set")) {
        throw new Error("Draft creation must not finalize the release.");
      }
      if (
        text.includes("from private.pipeline_runs as run") &&
        text.includes("exists (") &&
        text.includes("comparison-json")
      ) {
        return [{
          ...tier2RunRow,
          expected_current_publication_id:
            returnedExpectedCurrentPublicationId,
        }];
      }
      if (
        text.includes("select definition.stage, member.input_key")
      ) {
        return [];
      }
      if (text.includes("from private.pipeline_findings")) return [];
      if (text.includes("from private.pipeline_run_inputs")) {
        return [{
          position: 0,
          input_key: "partner-a",
          publication_id: publicationId,
          publication_checksum: "d".repeat(64),
          publication_row_count: 1,
        }];
      }
      return [];
    });
    vi.mocked(getDb).mockReturnValue({
      execute,
      transaction: (
        callback: (tx: { execute: typeof execute }) => unknown,
      ) => callback({ execute }),
    } as never);
    vi.mocked(listTier2PartnerProfiles).mockResolvedValue([{
      profileKey: "partner-a",
      partnerKey: "partner-a",
      active: true,
    }] as never);
    vi.mocked(listTier2StableTargets).mockResolvedValue([]);
    vi.mocked(uploadPipelineArtifact).mockImplementation(async (input) =>
      `pipeline-products/${input.kind}.json`
    );

    const releaseInput = {
      productKind: "tier2",
      resourceSetId,
      registryRevisionId,
      members: [{
        inputKey: "partner-a",
        publicationId,
        expectedChecksum: "d".repeat(64),
      }],
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Prepare exact release for review",
    } as const;

    await expect(createTier2ProductRelease({
      ...releaseInput,
      expectedCurrentPublicationId: launchPublicationId,
    })).resolves.toMatchObject({
      status: "valid",
      releaseSetId: tier2RunRow.release_set_id,
      expectedCurrentPublicationId: launchPublicationId,
    });

    expect(statements.some((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    )).toBe(true);
    expect(statements.some((statement) =>
      statement.includes("finalize_tier2_release_set")
    )).toBe(false);
    expect(statements.some((statement) =>
      statement.includes("select current_publication_id") &&
      statement.includes("from private.tier2_publication_targets")
    )).toBe(false);

    statements.length = 0;
    returnedExpectedCurrentPublicationId = null;
    await expect(createTier2ProductRelease({
      ...releaseInput,
      expectedCurrentPublicationId: null,
    })).resolves.toMatchObject({
      status: "valid",
      expectedCurrentPublicationId: null,
    });
    expect(statements.some((statement) =>
      statement.includes("select current_publication_id") &&
      statement.includes("from private.tier2_publication_targets")
    )).toBe(false);
  });

  it("finalizes the exact retained draft only after an explicit approval decision", async () => {
    const statements: string[] = [];
    const execute = vi.fn(async (statement: unknown) => {
      const text = sqlText(statement);
      statements.push(text);
      if (
        text.includes("select run.id as run_id") &&
        text.includes("for update of run, release_set")
      ) {
        return [{
          run_id: tier2RunRow.id,
          run_status: "valid",
          error_count: 0,
          release_set_id: tier2RunRow.release_set_id,
          release_status: "draft",
          canonical_checksum: null,
        }];
      }
      if (text.includes("select private.finalize_tier2_release_set")) {
        return [{ canonical_checksum: "f".repeat(64) }];
      }
      return [];
    });
    vi.mocked(getDb).mockReturnValue({
      transaction: (
        callback: (tx: { execute: typeof execute }) => unknown,
      ) => callback({ execute }),
    } as never);

    await expect(finalizeTier2ProductReleaseCandidate({
      runId: tier2RunRow.id,
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Approved exact release membership",
    })).resolves.toEqual({
      runId: tier2RunRow.id,
      releaseSetId: tier2RunRow.release_set_id,
      status: "finalized",
      canonicalChecksum: "f".repeat(64),
    });
    expect(statements.some((statement) =>
      statement.includes("finalize_tier2_release_set")
    )).toBe(true);
  });

  it("atomically cancels a draft release before rejecting its product run", async () => {
    const statements: string[] = [];
    const execute = vi.fn(async (statement: unknown) => {
      const text = sqlText(statement);
      statements.push(text);
      if (
        text.includes("select run.id as run_id") &&
        text.includes("for update of run, release_set")
      ) {
        return [{
          run_id: tier2RunRow.id,
          run_status: "valid",
          release_set_id: tier2RunRow.release_set_id,
          release_status: "draft",
        }];
      }
      if (text.includes("update private.pipeline_release_sets")) {
        return [{ id: tier2RunRow.release_set_id }];
      }
      if (
        text.includes("update private.pipeline_runs") &&
        text.includes("set status = 'rejected'")
      ) {
        return [{ id: tier2RunRow.id }];
      }
      if (
        text.includes("from private.pipeline_runs as run") &&
        text.includes("exists (") &&
        text.includes("comparison-json")
      ) {
        return [{
          ...tier2RunRow,
          status: "rejected",
          rejection_reason: "Membership not approved",
        }];
      }
      if (text.includes("select definition.stage, member.input_key")) return [];
      if (text.includes("from private.pipeline_findings")) return [];
      if (text.includes("from private.pipeline_run_inputs")) return [];
      return [];
    });
    vi.mocked(getDb).mockReturnValue({
      execute,
      transaction: (
        callback: (tx: { execute: typeof execute }) => unknown,
      ) => callback({ execute }),
    } as never);

    await expect(rejectTier2ProductRun({
      runId: tier2RunRow.id,
      reason: "Membership not approved",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
    })).resolves.toMatchObject({
      id: tier2RunRow.id,
      status: "rejected",
      rejectionReason: "Membership not approved",
    });
    const cancelledIndex = statements.findIndex((statement) =>
      statement.includes("update private.pipeline_release_sets")
    );
    const rejectedIndex = statements.findIndex((statement) =>
      statement.includes("set status = 'rejected'")
    );
    expect(cancelledIndex).toBeGreaterThan(-1);
    expect(rejectedIndex).toBeGreaterThan(cancelledIndex);
  });
});

describe("Tier 2 retained legacy comparison", () => {
  it("authenticates the retained comparison body against its audit record", async () => {
    const artifact = {
      schemaVersion: 1,
      runId: "10000000-0000-4000-8000-000000000001",
      report: { schemaVersion: 1 },
    };
    const body = JSON.stringify(artifact);
    const execute = vi.fn().mockResolvedValue([{
      storage_path: "pipeline-products/tier2/run/comparison-json.json",
      content_checksum: checksumSourceFormingValue(body),
      size_bytes: Buffer.byteLength(body, "utf8"),
    }]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);
    vi.mocked(readPipelineArtifact).mockResolvedValue(body);

    await expect(getTier2LegacyComparison(artifact.runId)).resolves.toEqual({
      artifact,
      body,
    });
  });
});

describe.each(["tier2", "aggregate2"] as const)(
  "%s candidate-owned publication CAS",
  (productKind) => {
    it("allows the first of two candidates built over the same target", () => {
      expect(() => assertTier2ProductCandidateTargetCurrent({
        productKind,
        expectedCurrentPublicationId: "publication-before-both-builds",
        currentPublicationId: "publication-before-both-builds",
      })).not.toThrow();
    });

    it("rejects the second candidate after the first advances the target", () => {
      expect(() => assertTier2ProductCandidateTargetCurrent({
        productKind,
        expectedCurrentPublicationId: "publication-before-both-builds",
        currentPublicationId: "publication-created-by-first-candidate",
      })).toThrow("advanced after this candidate was built");
    });
  },
);

describe("Tier 2 publication replay", () => {
  it("returns the committed publication when coordinator completion failed after commit", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{
        id: "published-run",
        definition_key: "tier2-complete-partners",
        display_name: "Tier 2",
        stage: "tier2-union",
        definition_version: "v1",
        definition_checksum: "a".repeat(64),
        release_set_id: "release-set",
        status: "published",
        input_fingerprint: "b".repeat(64),
        input_row_count: 4,
        output_row_count: 4,
        warning_count: 0,
        error_count: 0,
        output_checksum: "c".repeat(64),
        validation_summary: {},
        artifact_manifest: {},
        dataset_id: "stable-dataset",
        publication_id: "committed-publication",
        expected_current_publication_id: null,
        publication_target_key: "tier2-pgic",
        rejection_reason: null,
        publication_reason: "Reviewed",
        created_at: "2026-07-23T00:00:00.000Z",
        completed_at: "2026-07-23T00:01:00.000Z",
      }])
      .mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(publishTier2ProductRun({
      runId: "published-run",
      acknowledgeWarnings: true,
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Retry after injected coordinator completion failure",
    })).resolves.toMatchObject({
      publicationId: "committed-publication",
      versionNumber: null,
      run: {
        id: "published-run",
        status: "published",
        publicationId: "committed-publication",
      },
    });
    expect(uploadPipelineDatasetBlob).not.toHaveBeenCalled();
    expect(publishPreparedDataset).not.toHaveBeenCalled();
  });
});

describe("Tier 2 rollback restoration", () => {
  const columns = [{ key: "AX_PGIC", label: "AX_PGIC", sourceIndex: 0 }];
  const rows = [{ AX_PGIC: "10-jp-100001-LAO" }];
  const checksum = checksumSourceFormingValue({ columns, rows });

  it("validates the immutable publication rows and checksum", () => {
    expect(() => assertTier2RollbackSnapshot({
      columns,
      rows,
      expectedRowCount: 1,
      expectedOutputChecksum: checksum,
    })).not.toThrow();
    expect(() => assertTier2RollbackSnapshot({
      columns,
      rows: [{ AX_PGIC: "tampered" }],
      expectedRowCount: 1,
      expectedOutputChecksum: checksum,
    })).toThrow("immutable rows and checksum");
  });

  it("restores the selected rows through prepared dataset versioning before advancing the target", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{
        publication_target_key: "tier2-pgic",
        current_publication_id: "incident-publication",
        dataset_id: "stable-dataset",
        is_workspace_visible: true,
      }])
      .mockResolvedValueOnce([{
        output_checksum: checksum,
        row_count: 1,
        validation_summary: { columns },
      }])
      .mockResolvedValueOnce(rows.map((data) => ({ data })));
    vi.mocked(getDb).mockReturnValue({ execute } as never);
    vi.mocked(uploadPipelineDatasetBlob).mockResolvedValue("datasets/restored.csv");
    vi.mocked(publishPreparedDataset).mockImplementation(async (input) => {
      await input.finalize?.({
        executor: {
          execute: vi.fn(async () => [{ version_number: 7 }]),
        } as never,
        datasetId: "stable-dataset",
        created: false,
        archivedVersionId: "incident-version",
      });
      return { id: "stable-dataset" } as never;
    });

    await expect(rollbackTier2ProductTarget({
      productKind: "tier2",
      publicationId: "prior-publication",
      expectedCurrentPublicationId: "incident-publication",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Restore last verified release",
    })).resolves.toMatchObject({
      publicationId: "prior-publication",
      datasetId: "stable-dataset",
      versionNumber: 7,
    });
    expect(publishPreparedDataset).toHaveBeenCalledWith(expect.objectContaining({
      targetDatasetId: "stable-dataset",
      rows,
      columns,
      isWorkspaceVisible: true,
    }));
    expect(deletePipelineDatasetBlob).not.toHaveBeenCalled();
  });

  it("rejects stale rollback CAS before replacing consumer data", async () => {
    const execute = vi.fn().mockResolvedValueOnce([{
      publication_target_key: "aggregate2-pgic",
      current_publication_id: "newer-publication",
      dataset_id: "stable-dataset",
      is_workspace_visible: true,
    }]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(rollbackTier2ProductTarget({
      productKind: "aggregate2",
      publicationId: "prior-publication",
      expectedCurrentPublicationId: "stale-incident-publication",
      actorOwnerId: "admin",
      actorEmail: "admin@example.test",
      reason: "Restore last verified release",
    })).rejects.toThrow("changed since rollback review");
    expect(uploadPipelineDatasetBlob).not.toHaveBeenCalled();
    expect(publishPreparedDataset).not.toHaveBeenCalled();
  });
});
