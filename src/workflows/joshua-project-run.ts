import { getWorkflowMetadata } from "workflow";

import type { ApiConnectionArtifactChunk } from "@/lib/api-connection-output";
import type { CsvColumn } from "@/lib/api-types";
import { completeDurableJoshuaRun } from "@/lib/api-connections";
import {
  claimDurableJoshuaRun,
  executeDurableJoshuaPage,
  failDurableJoshuaRun,
} from "@/lib/api-connections/durable-joshua";

async function claimRunStep(runId: string, workflowRunId: string) {
  "use step";

  return claimDurableJoshuaRun({ runId, workflowRunId });
}

async function fetchPageStep(
  runId: string,
  page: number,
  priorFingerprints: string[],
) {
  "use step";

  return executeDurableJoshuaPage({ runId, page, priorFingerprints });
}

async function completeRunStep(input: {
  runId: string;
  columns: CsvColumn[];
  rawChunks: ApiConnectionArtifactChunk[];
  rowsChunks: ApiConnectionArtifactChunk[];
  httpStatus: number | null;
  responsePreview: string;
}) {
  "use step";

  return completeDurableJoshuaRun(input);
}

async function failRunStep(runId: string, message: string) {
  "use step";

  return failDurableJoshuaRun({ runId, message });
}

function mergeColumns(current: CsvColumn[], incoming: CsvColumn[]) {
  const seen = new Set(current.map((column) => column.key));
  return [
    ...current,
    ...incoming.filter((column) => {
      if (seen.has(column.key)) return false;
      seen.add(column.key);
      return true;
    }),
  ];
}

export async function joshuaProjectRunWorkflow(runId: string) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const claimed = await claimRunStep(runId, workflowRunId);
  if (!claimed) return { status: "not-claimed" as const };

  const fingerprints: string[] = [];
  const rawChunks: ApiConnectionArtifactChunk[] = [];
  const rowsChunks: ApiConnectionArtifactChunk[] = [];
  let columns: CsvColumn[] = [];
  let page = 1;
  let httpStatus: number | null = null;
  let responsePreview = "";

  try {
    while (true) {
      const result = await fetchPageStep(runId, page, fingerprints);
      rawChunks.push(result.rawChunk);
      rowsChunks.push(result.rowsChunk);
      columns = mergeColumns(columns, result.columns);
      if (result.fingerprint) fingerprints.push(result.fingerprint);
      httpStatus = result.httpStatus;
      if (!responsePreview) responsePreview = result.responsePreview;

      if (result.terminal) break;
      page += 1;
    }

    await completeRunStep({
      runId,
      columns,
      rawChunks,
      rowsChunks,
      httpStatus,
      responsePreview,
    });
    return { status: "completed" as const, pages: rawChunks.length };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Joshua Project durable run failed.";
    await failRunStep(runId, message);
    throw error;
  }
}
