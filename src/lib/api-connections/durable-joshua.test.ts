import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import { downloadApiConnectionArtifactText } from "./chunked-output";
import {
  cancelApiConnectionRun,
  executeDurableJoshuaPage,
  reconcileStaleApiConnectionRuns,
} from "./durable-joshua";
import { fetchJoshuaProjectPeopleGroupPage } from "./providers/joshua-project";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("./index", () => ({
  JOSHUA_PROJECT_API_CONNECTION_ID:
    "6f9f6ef2-1188-4f71-9c24-ef01debf7a03",
  applyCodeManagedDefinitionForExecution: vi.fn(),
}));
vi.mock("./chunked-output", () => ({
  downloadApiConnectionArtifactText: vi.fn(),
  uploadApiConnectionRunChunk: vi.fn(),
}));
vi.mock("./providers/joshua-project", () => ({
  JOSHUA_PROJECT_PAGE_SIZE: 100,
  MAX_JOSHUA_PROJECT_PAGES: 1000,
  MAX_JOSHUA_PROJECT_RESPONSE_BYTES: 192 * 1024 * 1024,
  fetchJoshuaProjectPeopleGroupPage: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);
const run = {
  id: "run-1",
  connectionId: "6f9f6ef2-1188-4f71-9c24-ef01debf7a03",
  workflowRunId: "wrun_test",
  errorMessage: "Durable run stopped reporting progress and was safely closed.",
};

function mockMutation(returningValue: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningValue);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const values = vi.fn().mockResolvedValue(undefined);
  const db = {
    update: vi.fn(() => ({ set })),
    insert: vi.fn(() => ({ values })),
  };
  getDbMock.mockReturnValue(db as never);
  return { db, set, where, returning, values };
}

describe("durable Joshua run state", () => {
  beforeEach(() => vi.resetAllMocks());

  it("atomically records terminal cancellation and a run log", async () => {
    const mocks = mockMutation([run]);

    await expect(
      cancelApiConnectionRun({ connectionId: run.connectionId, runId: run.id }),
    ).resolves.toEqual(run);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        stage: "cancelled",
        cancelRequestedAt: expect.any(Date),
        completedAt: expect.any(Date),
      }),
    );
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ runId: run.id, message: expect.stringContaining("cancelled") }),
    );
  });

  it("does not create a cancellation log when no active run was claimed", async () => {
    const mocks = mockMutation([]);

    await expect(
      cancelApiConnectionRun({ connectionId: run.connectionId, runId: run.id }),
    ).resolves.toBeNull();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("closes stale durable runs and records the reason", async () => {
    const mocks = mockMutation([run]);

    await expect(
      reconcileStaleApiConnectionRuns({ now: new Date("2026-08-17T22:00:00Z") }),
    ).resolves.toBe(1);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", stage: "failed" }),
    );
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ message: run.errorMessage }),
    );
  });

  it("replays an accepted page from immutable chunks without refetching upstream", async () => {
    const durableRun = {
      ...run,
      status: "running",
      cancelRequestedAt: null,
      deadlineAt: new Date("2099-08-18T00:00:00Z"),
      pagesCompleted: 1,
      recordsCompleted: 1,
      bytesProcessed: 12,
      httpStatus: 200,
    };
    const limit = vi.fn().mockResolvedValue([
      { run: durableRun, connection: { id: run.connectionId, archivedAt: null } },
    ]);
    const where = vi.fn(() => ({ limit }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    getDbMock.mockReturnValue({ select: vi.fn(() => ({ from })) } as never);
    vi.mocked(downloadApiConnectionArtifactText)
      .mockResolvedValueOnce('[{"PeopleID3":1}]')
      .mockResolvedValueOnce(
        JSON.stringify({
          columns: [{ key: "peopleid3", label: "PeopleID3", sourceIndex: 0 }],
          rows: [{ peopleid3: "1" }],
        }),
      );

    const result = await executeDurableJoshuaPage({
      runId: run.id,
      page: 1,
      priorFingerprints: [],
    });

    expect(result.recordCount).toBe(1);
    expect(result.terminal).toBe(true);
    expect(fetchJoshuaProjectPeopleGroupPage).not.toHaveBeenCalled();
  });
});
