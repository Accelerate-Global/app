import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const BINARY_OR_GENERATED_EXTENSIONS = /\.(ico|jpg|jpeg|lock|png|webp)$/i;

const DISALLOWED_PUBLICATION_PATTERNS = [
  {
    label: "personal admin email domain",
    pattern: new RegExp(["risen", "code\\.org"].join(""), "i"),
  },
  {
    label: "legacy personal admin email prefix",
    pattern: /\b(?:blake|will)@/i,
  },
  {
    label: "named bootstrap-account prose",
    pattern: /\bBlake (?:account|user)\b/,
  },
];

function getTrackedTextFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
  });

  return output
    .split("\0")
    .filter(Boolean)
    .filter((filePath) => !BINARY_OR_GENERATED_EXTENSIONS.test(filePath));
}

describe("publication safety", () => {
  it("keeps real personal/admin identifiers out of tracked text files", () => {
    const matches: string[] = [];

    for (const filePath of getTrackedTextFiles()) {
      const contents = readFileSync(filePath, "utf8");

      for (const { label, pattern } of DISALLOWED_PUBLICATION_PATTERNS) {
        if (pattern.test(contents)) {
          matches.push(`${filePath}: ${label}`);
        }
      }
    }

    expect(matches).toEqual([]);
  });
});
