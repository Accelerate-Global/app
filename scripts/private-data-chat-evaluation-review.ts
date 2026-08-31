import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { renderPrivateDataChatEvaluationReview } from "../src/lib/private-data-chat/evaluation-suite-review";

export const PRIVATE_DATA_CHAT_EVALUATION_REVIEW_PATH = path.join(
  process.cwd(),
  "docs/operations/private-data-chat-evaluation-suite-v4-review.md",
);

export function runPrivateDataChatEvaluationReview(argv = process.argv.slice(2)) {
  const review = renderPrivateDataChatEvaluationReview();

  if (argv.includes("--write")) {
    writeFileSync(PRIVATE_DATA_CHAT_EVALUATION_REVIEW_PATH, review, "utf8");
    console.log(`Wrote ${PRIVATE_DATA_CHAT_EVALUATION_REVIEW_PATH}`);
    return;
  }

  if (argv.includes("--check")) {
    const committed = readFileSync(
      PRIVATE_DATA_CHAT_EVALUATION_REVIEW_PATH,
      "utf8",
    );
    if (committed !== review) {
      throw new Error(
        "The committed private-data-chat evaluation review is stale. Run this script with --write.",
      );
    }
    console.log("Private-data-chat evaluation review is current.");
    return;
  }

  process.stdout.write(review);
}

if (process.argv[1]?.endsWith("private-data-chat-evaluation-review.ts")) {
  runPrivateDataChatEvaluationReview();
}
