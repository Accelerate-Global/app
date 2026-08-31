import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { buildPrivateDataChatLiveEvaluationBundle } from "../src/lib/private-data-chat/evaluation-suite-export";

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function parseOutputDirectory(argv: string[]) {
  const index = argv.indexOf("--output");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value) {
    throw new Error("Pass an explicit directory after --output.");
  }
  const resolved = path.resolve(value);
  if (resolved === path.parse(resolved).root) {
    throw new Error("Refusing to use a filesystem root as the export directory.");
  }
  return resolved;
}

function prettyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function runPrivateDataChatEvaluationExport(
  argv = process.argv.slice(2),
) {
  const outputDirectory = parseOutputDirectory(argv);
  const compilerSource = readFileSync(
    path.join(
      process.cwd(),
      "src/lib/private-data-chat/compiler.ts",
    ),
  );
  const reviewDocument = readFileSync(
    path.join(
      process.cwd(),
      "docs/operations/private-data-chat-evaluation-suite-v4-review.md",
    ),
  );
  const benchmarkPath = path.join(
    process.cwd(),
    "scripts/private-data-chat-evaluation-benchmark.py",
  );
  const benchmarkSource = readFileSync(benchmarkPath);
  const bundle = buildPrivateDataChatLiveEvaluationBundle({
    compilerSourceSha256: sha256(compilerSource),
    reviewDocumentSha256: sha256(reviewDocument),
    benchmarkSourceSha256: sha256(benchmarkSource),
  });

  mkdirSync(outputDirectory, { recursive: true });
  const files: Record<string, string | Buffer> = {
    "plan-cases.json": prettyJson(bundle.documents.plans),
    "answer-cases.json": prettyJson(bundle.documents.answers),
    "end-to-end-cases.json": prettyJson(bundle.documents.endToEnd),
    "plan-prompt.txt": `${bundle.documents.plannerPrompt}\n`,
    "answer-prompt.txt": `${bundle.documents.answerPrompt}\n`,
    "plan-schema.json": prettyJson(bundle.documents.plannerSchema),
    "answer-schema.json": prettyJson(bundle.documents.answerSchema),
    "benchmark.py": benchmarkSource,
  };

  for (const [fileName, contents] of Object.entries(files)) {
    writeFileSync(path.join(outputDirectory, fileName), contents);
  }

  const fileSha256 = Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((fileName) => [
        fileName,
        sha256(readFileSync(path.join(outputDirectory, fileName))),
      ]),
  );
  const manifest = {
    ...bundle.manifest,
    file_sha256: fileSha256,
  };
  writeFileSync(
    path.join(outputDirectory, "manifest.json"),
    prettyJson(manifest),
  );

  console.log(
    JSON.stringify(
      {
        outputDirectory,
        suiteId: manifest.suite_id,
        counts: manifest.counts,
        hashes: manifest.hashes,
        fileSha256,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1]?.endsWith("private-data-chat-evaluation-export.ts")) {
  runPrivateDataChatEvaluationExport();
}
