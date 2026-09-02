import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrivateDataChatLiveEvaluationBundle } from "@/lib/private-data-chat/evaluation-suite-export";
import { runPrivateDataChatEvaluationExport } from "../../../scripts/private-data-chat-evaluation-export";

const temporaryDirectories: string[] = [];

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceInputs() {
  const compiler = readFileSync(
    path.join(process.cwd(), "src/lib/private-data-chat/compiler.ts"),
  );
  const review = readFileSync(
    path.join(
      process.cwd(),
      "docs/operations/private-data-chat-evaluation-suite-v4-review.md",
    ),
  );
  const benchmark = readFileSync(
    path.join(
      process.cwd(),
      "scripts/private-data-chat-evaluation-benchmark.py",
    ),
  );
  return {
    compilerSourceSha256: sha256(compiler),
    reviewDocumentSha256: sha256(review),
    benchmarkSourceSha256: sha256(benchmark),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("private data chat live evaluation export", () => {
  it("builds one deterministic hash-bound extended bundle", () => {
    const first = buildPrivateDataChatLiveEvaluationBundle(sourceInputs());
    const second = buildPrivateDataChatLiveEvaluationBundle(sourceInputs());

    expect(first).toEqual(second);
    expect(first.manifest.counts).toEqual({
      total: 450,
      planner: 374,
      answer: 38,
      end_to_end: 38,
      clean_model_calls: 1236,
    });
    expect(first.documents.plans.cases).toHaveLength(374);
    expect(first.documents.answers.cases).toHaveLength(38);
    expect(first.documents.endToEnd.cases).toHaveLength(38);
    expect(first.manifest.approved_execution).toEqual({
      tier: "extended",
      diagnostic_repetitions: 1,
      clean_model_repetitions: 3,
      end_to_end_repetitions: 3,
    });
  });

  it("writes files whose bytes match the generated manifest", () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), "private-qwen-eval-export-"),
    );
    temporaryDirectories.push(directory);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    runPrivateDataChatEvaluationExport(["--output", directory]);

    const manifest = JSON.parse(
      readFileSync(path.join(directory, "manifest.json"), "utf8"),
    ) as { file_sha256: Record<string, string> };
    for (const [fileName, expected] of Object.entries(
      manifest.file_sha256,
    )) {
      expect(sha256(readFileSync(path.join(directory, fileName)))).toBe(
        expected,
      );
    }
  });

  it("passes the isolated Python scorer self-test", () => {
    expect(
      execFileSync(
        "python3",
        [
          path.join(
            process.cwd(),
            "scripts/private-data-chat-evaluation-benchmark.py",
          ),
          "--self-test",
        ],
        { encoding: "utf8" },
      ),
    ).toContain("self-test passed");
  });
});
