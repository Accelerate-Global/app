// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PipelineOperationsClient } from "./pipeline-operations-client";

const definition = {
  key: "source-imb-people-groups",
  label: "IMB people groups",
  description: "Ingest and form IMB.",
  version: "v1",
  checksum: "a".repeat(64),
  scheduleEligible: true,
  semanticDependencies: [],
  stages: [
    {
      key: "imb-ingest",
      label: "Ingest IMB",
      description: "Ingest IMB",
      kind: "ingestion" as const,
      effectKey: "source-ingestion",
      maxAttempts: 3,
    },
  ],
};

const run = {
  id: "00000000-0000-4000-8000-000000000001",
  definitionKey: definition.key,
  definitionVersion: "v1",
  definitionChecksum: definition.checksum,
  correlationId: "correlation-1",
  launchKind: "manual" as const,
  inputFingerprint: "b".repeat(64),
  status: "awaiting_review" as const,
  currentStageKey: "imb-review",
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  progressCurrent: 2,
  progressTotal: 3,
  rowCount: 100,
  warningCount: 1,
  errorCount: 0,
  publicationId: null,
  outOfDate: false,
  errorCode: null,
  errorMessage: null,
  stageCount: 3,
  completedStageCount: 2,
  retryCount: 0,
  startedAt: "2026-07-22T00:00:00.000Z",
  completedAt: null,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:01:00.000Z",
};

const reviewStage = {
  id: "00000000-0000-4000-8000-000000000010",
  key: "imb-review",
  index: 1,
  kind: "review" as const,
  effectKey: "operator-review",
  status: "awaiting_review" as const,
  maxAttempts: 1,
  attemptCount: 1,
  progressCurrent: 1,
  progressTotal: 1,
  exactInputs: { sourcePublicationId: "publication-1" },
  output: { candidateId: "candidate-1" },
  findingSummary: { warningCount: 1, errorCount: 0 },
  errorCode: null,
  errorMessage: null,
  startedAt: "2026-07-22T00:00:30.000Z",
  completedAt: null,
  attempts: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      attemptNumber: 1,
      workerId: "worker-1",
      status: "awaiting_review" as const,
      retryable: null,
      progress: { current: 1, total: 1 },
      output: { candidateId: "candidate-1" },
      findingSummary: { warningCount: 1, errorCount: 0 },
      errorCode: null,
      errorMessage: null,
      startedAt: "2026-07-22T00:00:30.000Z",
      heartbeatAt: "2026-07-22T00:01:00.000Z",
      completedAt: "2026-07-22T00:01:00.000Z",
    },
  ],
};

const detail = {
  ...run,
  exactInputs: { connectionIds: { "imb-people-groups": "connection-1" } },
  stages: [reviewStage],
  events: [],
};

describe("PipelineOperationsClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("disables flows whose deployed stage adapters are incomplete", () => {
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[]}
        initialSchedules={[]}
        availableEffectKeys={[]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Run pipeline" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText(/remains disabled until all downstream stage adapters/i),
    ).toBeTruthy();
  });

  it("opens operational history in a half-page detail sheet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ run: detail }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[run]}
        initialSchedules={[]}
        availableEffectKeys={["source-ingestion"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "IMB people groups" }));
    await waitFor(() => expect(screen.getByText("Run detail")).toBeTruthy());
    const surface = document.querySelector(
      '[data-smoke-surface="pipeline-run-detail"]',
    );
    expect(surface).toBeTruthy();
    expect(surface?.className).toContain("md:w-1/2");
    expect(
      document.querySelector("[data-smoke-pipeline-stage-timeline]"),
    ).toBeTruthy();
    expect(
      document.querySelector("[data-smoke-pipeline-attempt-history]"),
    ).toBeTruthy();
    const exactInputs = document.querySelector(
      "[data-smoke-pipeline-exact-inputs]",
    );
    expect(exactInputs).toBeTruthy();
    expect(exactInputs?.textContent).toContain("connection-1");
  });

  it("launches a manual run and opens its review pause", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (
        url === "/api/admin/pipeline-operations/runs" &&
        init?.method === "POST"
      ) {
        return Response.json({ run: detail }, { status: 202 });
      }
      if (url === "/api/admin/pipeline-operations/runs") {
        return Response.json({ runs: [run] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[]}
        initialSchedules={[]}
        availableEffectKeys={["source-ingestion"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/pipeline-operations/runs",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(`"definitionKey":"${definition.key}"`),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Run detail" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Review Required").length).toBeGreaterThan(0);
    expect(
      document.querySelector("[data-smoke-pipeline-launch]"),
    ).toBeTruthy();
  });

  it("resumes an awaiting-review run after an explicit approval", async () => {
    let approved = false;
    const succeededRun = {
      ...run,
      status: "succeeded" as const,
      currentStageKey: null,
      warningCount: 0,
      completedStageCount: 3,
      completedAt: "2026-07-22T00:02:00.000Z",
    };
    const succeededDetail = {
      ...detail,
      ...succeededRun,
      stages: [
        {
          ...reviewStage,
          status: "succeeded" as const,
          completedAt: "2026-07-22T00:02:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/review")) {
        approved = true;
        return Response.json({ accepted: true }, { status: 202 });
      }
      if (url === "/api/admin/pipeline-operations/runs") {
        return Response.json({ runs: [approved ? succeededRun : run] });
      }
      if (url.endsWith(`/runs/${run.id}`)) {
        return Response.json({ run: approved ? succeededDetail : detail });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[run]}
        initialSchedules={[]}
        availableEffectKeys={["source-ingestion"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "IMB people groups" }));
    await screen.findByRole("heading", { name: "Run detail" });
    fireEvent.change(screen.getByLabelText("Decision or retry reason"), {
      target: { value: "Reviewed candidate evidence" },
    });
    fireEvent.click(
      document.querySelector(
        "[data-smoke-pipeline-warning-acknowledgement]",
      )!,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve and continue" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/pipeline-operations/runs/${run.id}/review`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            stageKey: "imb-review",
            decision: "approve",
            reason: "Reviewed candidate evidence",
            acknowledgeWarnings: true,
          }),
        }),
      ),
    );
    expect(await screen.findByText("Review approved.")).toBeTruthy();
    expect(screen.getAllByText("Up To Date").length).toBeGreaterThan(0);
  });

  it("retries a failed stage and refreshes the exact run", async () => {
    const failedRun = {
      ...run,
      status: "failed" as const,
      warningCount: 0,
      errorCount: 1,
      errorCode: "STAGE_FAILED",
      errorMessage: "Source stage failed.",
    };
    const failedDetail = {
      ...detail,
      ...failedRun,
      stages: [
        {
          ...reviewStage,
          status: "failed" as const,
          findingSummary: { warningCount: 0, errorCount: 1 },
          errorCode: "STAGE_FAILED",
          errorMessage: "Source stage failed.",
        },
      ],
    };
    const queuedRun = {
      ...failedRun,
      status: "queued" as const,
      errorCode: null,
      errorMessage: null,
      retryCount: 1,
    };
    const queuedDetail = { ...failedDetail, ...queuedRun };
    let retried = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/retry")) {
        retried = true;
        return Response.json({ accepted: true }, { status: 202 });
      }
      if (url === "/api/admin/pipeline-operations/runs") {
        return Response.json({ runs: [retried ? queuedRun : failedRun] });
      }
      if (url.endsWith(`/runs/${run.id}`)) {
        return Response.json({ run: retried ? queuedDetail : failedDetail });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[failedRun]}
        initialSchedules={[]}
        availableEffectKeys={["source-ingestion"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "IMB people groups" }));
    const retryButton = await screen.findByRole("button", {
      name: "Retry failed stage",
    });
    fireEvent.change(screen.getByLabelText("Decision or retry reason"), {
      target: { value: "Retry transient source failure" },
    });
    fireEvent.click(retryButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/pipeline-operations/runs/${run.id}/retry`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            stageKey: "imb-review",
            reason: "Retry transient source failure",
          }),
        }),
      ),
    );
    expect(await screen.findByText("Retry accepted.")).toBeTruthy();
    expect(screen.getAllByText("Queued").length).toBeGreaterThan(0);
  });

  it("lets an operator continue a queued run from the detail sheet", async () => {
    const queuedRun = {
      ...run,
      status: "queued" as const,
      currentStageKey: "imb-forming",
    };
    const queuedDetail = { ...detail, ...queuedRun };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/continue")) {
        return new Response(JSON.stringify({ accepted: true, runId: queuedRun.id }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/admin/pipeline-operations/runs") {
        return new Response(JSON.stringify({ runs: [queuedRun] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ run: queuedDetail }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PipelineOperationsClient
        definitions={[definition]}
        initialRuns={[queuedRun]}
        initialSchedules={[]}
        availableEffectKeys={["source-ingestion"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "IMB people groups" }));
    const continueButton = await screen.findByRole("button", {
      name: "Continue run",
    });
    await waitFor(() =>
      expect(continueButton.hasAttribute("disabled")).toBe(false),
    );
    fireEvent.click(continueButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/pipeline-operations/runs/${queuedRun.id}/continue`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByText(/Continuation accepted/i),
    ).toBeTruthy();
  });
});
