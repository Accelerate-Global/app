import type { PipelineRunDetail, PipelineRunSummary } from "./types";

export type PipelineDiagnostic = Readonly<{
  severity: "info" | "warning" | "error";
  code: string;
  title: string;
  message: string;
  recovery: string | null;
  stageKey: string | null;
}>;

export function getPipelineRunDiagnostics(
  run: PipelineRunSummary | PipelineRunDetail,
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];

  if (run.outOfDate) {
    diagnostics.push({
      severity: "warning",
      code: "definition-out-of-date",
      title: "Definition changed",
      message: "This run used an older code-defined flow checksum.",
      recovery: "Rebuild with current resources and the current flow definition.",
      stageKey: run.currentStageKey,
    });
  }

  if (run.status === "awaiting_review") {
    diagnostics.push({
      severity: "info",
      code: "review-required",
      title: "Review required",
      message: "Automation stopped before an identity, candidate, release, or publication decision.",
      recovery: "Inspect exact inputs and findings, then explicitly approve or reject the gate.",
      stageKey: run.currentStageKey,
    });
  }

  if (run.status === "failed") {
    diagnostics.push({
      severity: "error",
      code: run.errorCode ?? "pipeline-failed",
      title: "Pipeline failed",
      message: run.errorMessage ?? "A pipeline stage failed.",
      recovery: run.errorCode === "stage-adapter-missing"
        ? "Deploy the bounded stage adapter before retrying this definition."
        : "Review the failed attempt, correct the input or provider issue, then retry the stage.",
      stageKey: run.currentStageKey,
    });
  }

  if ("stages" in run) {
    for (const stage of run.stages) {
      const interrupted = stage.attempts.filter((attempt) => attempt.status === "interrupted");
      if (interrupted.length > 0) {
        diagnostics.push({
          severity: "warning",
          code: "stale-stage-recovered",
          title: "Interrupted work recovered",
          message: `${stage.key} has ${interrupted.length} expired worker attempt${interrupted.length === 1 ? "" : "s"}.`,
          recovery: stage.status === "failed" ? "Authorize a manual retry after checking provider health." : "No action is required while the retry remains queued.",
          stageKey: stage.key,
        });
      }
    }
  }

  return diagnostics;
}
