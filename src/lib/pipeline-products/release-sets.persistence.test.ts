import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/db", () => ({ getDb: getDbMock }));

import { checksumProductValue } from "@/lib/tier1-products";

import {
  createPipelineReleaseSetCandidate,
  finalizePipelineReleaseSet,
  finalizePipelineReleaseSetCandidate,
  rejectPipelineReleaseSetCandidate,
} from "./release-sets";
import type { CreatePipelineReleaseCandidateInput } from "./types";

const priorities = [{
  canonicalField: "PG_Name",
  prioritySourceKeys: ["jp", "imb"],
}];
const releaseSetId = "90000000-0000-4000-8000-000000000001";
const resourceSetId = "90000000-0000-4000-8000-000000000002";
const selectedRevisionId = "90000000-0000-4000-8000-000000000003";
const sourceProfiles = [
  "accelerate-owned-people-groups",
  "etnopedia-people-groups",
  "imb-people-groups",
  "joshua-project-pgic",
  "wcd-people-groups",
] as readonly string[];
const inputKeys = ["ax", "etno", "imb", "jp", "wcd"] as const;

function candidateInput(): CreatePipelineReleaseCandidateInput {
  return {
    releaseKey: "tier1-coordinated-run",
    resourceSetId,
    registryRevisionId: selectedRevisionId,
    ruleVersion: "v1",
    ruleChecksum: checksumProductValue(priorities),
    priorities,
    members: inputKeys.map((inputKey, index) => ({
      inputKey,
      publicationId: `90000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      expectedChecksum: String(index + 1).repeat(64),
    })),
    actorOwnerId: "admin-1",
    actorEmail: "admin@example.test",
  };
}

function releaseRow(
  status: "draft" | "finalized" | "cancelled",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: releaseSetId,
    release_key: "tier1-coordinated-run",
    resource_set_id: resourceSetId,
    registry_revision_id: selectedRevisionId,
    rule_version: "v1",
    rule_checksum: checksumProductValue(priorities),
    rule_payload: priorities,
    status,
    canonical_checksum: "f".repeat(64),
    created_by_owner_id: "admin-1",
    created_by_email: "admin@example.test",
    finalized_by_owner_id: status === "draft" ? null : "admin-1",
    finalized_by_email: status === "draft" ? null : "admin@example.test",
    finalization_reason: status === "draft" ? null : "Reviewed decision",
    finalized_at: status === "draft" ? null : "2026-07-23T00:00:00.000Z",
    created_at: "2026-07-22T23:00:00.000Z",
    ...overrides,
  };
}

function publications(input = candidateInput()) {
  return input.members.map((member, index) => ({
    id: member.publicationId,
    producer_kind: "identity",
    producer_run_id: `91000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    source_profile_key: sourceProfiles[index],
    registry_revision_id: `92000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    output_checksum: member.expectedChecksum,
    row_count: index + 1,
    actual_row_count: index + 1,
    publication_target_key: null,
    created_at: "2026-07-22T22:00:00.000Z",
  }));
}

function sqlText(statement: unknown) {
  return new PgDialect().sqlToQuery(statement as never).sql;
}

function installCandidateDatabase(options?: {
  compatible?: boolean;
  missingBindingCount?: number;
  publicationRows?: ReturnType<typeof publications>;
}) {
  const statements: string[] = [];
  const execute = vi.fn(async (statement: unknown) => {
    const text = sqlText(statement);
    statements.push(text);
    if (text.includes("from private.reference_resource_sets")) {
      return [{ id: resourceSetId }];
    }
    if (
      text.includes("from private.ax_registry_revisions") &&
      !text.includes("join private.ax_registry_revisions")
    ) {
      return [{ id: selectedRevisionId, revision_number: 8 }];
    }
    if (
      text.includes("from private.pipeline_publications as publication") &&
      text.includes("actual_row_count")
    ) {
      return options?.publicationRows ?? publications();
    }
    if (text.includes("selected_revision_is_current_enough")) {
      return [{
        selected_revision_is_current_enough: options?.compatible ?? true,
        missing_binding_count: options?.missingBindingCount ?? 0,
      }];
    }
    if (
      text.includes("select * from private.pipeline_release_sets") &&
      text.includes("canonical_checksum")
    ) {
      return [];
    }
    if (
      text.includes("select * from private.pipeline_release_sets") &&
      text.includes("for update")
    ) {
      return [releaseRow("draft")];
    }
    if (text.includes("insert into private.pipeline_release_sets")) {
      return [releaseRow("draft")];
    }
    if (text.includes("set status = 'finalized'")) {
      return [releaseRow("finalized")];
    }
    return [];
  });
  getDbMock.mockReturnValue({
    transaction: (callback: (tx: { execute: typeof execute }) => unknown) =>
      callback({ execute }),
  });
  return { execute, statements };
}

describe("pipeline release candidate persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("validates all five sequential-origin publications before review, then finalizes the retained candidate", async () => {
    const { statements } = installCandidateDatabase();
    const candidate = await createPipelineReleaseSetCandidate(candidateInput());

    expect(candidate).toMatchObject({ id: releaseSetId, status: "draft" });
    expect(
      statements.filter((statement) =>
        statement.includes("selected_revision_is_current_enough")
      ),
    ).toHaveLength(5);
    const insertIndex = statements.findIndex((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    );
    const lastCompatibilityIndex = statements.findLastIndex((statement) =>
      statement.includes("selected_revision_is_current_enough")
    );
    expect(insertIndex).toBeGreaterThan(lastCompatibilityIndex);

    const executeDecision = vi.fn(async (statement: unknown) => {
      const text = sqlText(statement);
      if (
        text.includes("select * from private.pipeline_release_sets") &&
        text.includes("for update")
      ) {
        return [releaseRow("draft")];
      }
      if (text.includes("set status = 'finalized'")) {
        return [releaseRow("finalized")];
      }
      return [];
    });
    getDbMock.mockReturnValue({
      transaction: (
        callback: (tx: { execute: typeof executeDecision }) => unknown,
      ) => callback({ execute: executeDecision }),
    });

    await expect(finalizePipelineReleaseSetCandidate({
      releaseSetId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.test",
      reason: "Reviewed exact release",
    })).resolves.toMatchObject({ id: releaseSetId, status: "finalized" });
  });

  it("keeps the compatibility wrapper as a complete create-and-finalize operation", async () => {
    const { statements } = installCandidateDatabase();

    await expect(finalizePipelineReleaseSet({
      ...candidateInput(),
      reason: "Reviewed through the compatibility API",
    })).resolves.toMatchObject({
      id: releaseSetId,
      status: "finalized",
      finalizationReason: "Reviewed decision",
    });

    expect(statements.some((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    )).toBe(true);
    expect(statements.some((statement) =>
      statement.includes("set status = 'finalized'")
    )).toBe(true);
  });

  it("rejects an older selected registry revision before creating a candidate", async () => {
    const { statements } = installCandidateDatabase({ compatible: false });

    await expect(createPipelineReleaseSetCandidate(candidateInput()))
      .rejects.toMatchObject({
        code: "registry-revision-too-old",
      });
    expect(statements.some((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    )).toBe(false);
  });

  it("rejects a selected revision missing an exact binding before creating a candidate", async () => {
    const { statements } = installCandidateDatabase({ missingBindingCount: 1 });

    await expect(createPipelineReleaseSetCandidate(candidateInput()))
      .rejects.toMatchObject({
        code: "registry-binding-mismatch",
      });
    expect(statements.some((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    )).toBe(false);
  });

  it("rejects a publication from the wrong source profile before candidate creation", async () => {
    const rows = publications();
    rows[0] = { ...rows[0], source_profile_key: "wrong-profile" };
    const { statements } = installCandidateDatabase({ publicationRows: rows });

    await expect(createPipelineReleaseSetCandidate(candidateInput()))
      .rejects.toMatchObject({
        code: "source-profile-mismatch",
      });
    expect(statements.some((statement) =>
      statement.includes("insert into private.pipeline_release_sets")
    )).toBe(false);
  });

  it("records an explicit domain rejection on the durable draft candidate", async () => {
    const execute = vi.fn(async (statement: unknown) => {
      const text = sqlText(statement);
      if (
        text.includes("select * from private.pipeline_release_sets") &&
        text.includes("for update")
      ) {
        return [releaseRow("draft")];
      }
      if (text.includes("set status = 'cancelled'")) {
        return [releaseRow("cancelled", {
          finalization_reason: "Rejected incomplete release",
        })];
      }
      return [];
    });
    getDbMock.mockReturnValue({
      transaction: (callback: (tx: { execute: typeof execute }) => unknown) =>
        callback({ execute }),
    });

    await expect(rejectPipelineReleaseSetCandidate({
      releaseSetId,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.test",
      reason: "Rejected incomplete release",
    })).resolves.toMatchObject({
      id: releaseSetId,
      status: "cancelled",
      finalizationReason: null,
      rejectionReason: "Rejected incomplete release",
    });
  });
});
