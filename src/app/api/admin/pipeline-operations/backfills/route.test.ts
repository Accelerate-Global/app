import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  assertCompleteBackfillInputs,
  assertExactBackfillInputs,
  assertPinnedReferenceResourceSnapshot,
  createPipelineFlowRun,
  PipelineOperationError,
} from "@/lib/pipeline-operations";

import { POST } from "./route";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/pipeline-operations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-operations")>(
    "@/lib/pipeline-operations",
  );
  return {
    ...actual,
    assertCompleteBackfillInputs: vi.fn(),
    assertExactBackfillInputs: vi.fn(),
    assertPinnedReferenceResourceSnapshot: vi.fn(),
    createPipelineFlowRun: vi.fn(),
    executePipelineUntilPause: vi.fn(),
  };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.test",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/pipeline-operations/backfills", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(createPipelineFlowRun).mockResolvedValue({
      created: false,
      run: { id: "run-1" },
    } as never);
  });

  it("checks flow-specific completeness before creating a historical run", async () => {
    const exactInputs = {
      sourceRunId: "10000000-0000-4000-8000-000000000001",
      sourceChecksum: "a".repeat(64),
    };
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-operations/backfills",
      {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          requestId: "10000000-0000-4000-8000-000000000002",
          exactInputs,
        }),
      },
    ));

    expect(response.status).toBe(200);
    expect(assertExactBackfillInputs).toHaveBeenCalledWith(exactInputs);
    expect(assertCompleteBackfillInputs).toHaveBeenCalledWith(
      expect.objectContaining({ key: "source-imb-people-groups" }),
      exactInputs,
    );
    expect(assertPinnedReferenceResourceSnapshot).toHaveBeenCalledWith(
      exactInputs,
    );
    expect(createPipelineFlowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        launchKind: "backfill",
        exactInputs,
      }),
    );
  });

  it("does not retain a run when exact resource evidence differs from the database", async () => {
    vi.mocked(assertPinnedReferenceResourceSnapshot).mockRejectedValue(
      new PipelineOperationError(
        "The exact resource checksum does not match.",
        409,
        "backfill-resource-checksum-mismatch",
      ),
    );
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-operations/backfills",
      {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          requestId: "10000000-0000-4000-8000-000000000002",
          exactInputs: {
            sourceRunId: "10000000-0000-4000-8000-000000000001",
          },
        }),
      },
    ));

    expect(response.status).toBe(409);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("does not create a run when required flow pins are missing", async () => {
    vi.mocked(assertCompleteBackfillInputs).mockImplementation(() => {
      throw new PipelineOperationError(
        "The archived source checksum is required.",
        400,
        "backfill-source-checksum-required",
      );
    });
    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-operations/backfills",
      {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          requestId: "10000000-0000-4000-8000-000000000002",
          exactInputs: {
            sourceRunId: "10000000-0000-4000-8000-000000000001",
          },
        }),
      },
    ));

    expect(response.status).toBe(400);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });
});
