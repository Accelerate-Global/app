import { describe, expect, it } from "vitest";

import {
  parseGitDiffNameStatus,
  parseGitStatusPorcelain,
} from "./git-status";

describe("git-status", () => {
  it("parses git status porcelain output", () => {
    expect(
      parseGitStatusPorcelain(
        " M src/app.tsx\0R  old-name.ts\0new-name.ts\0?? scripts/new-file.ts\0",
      ),
    ).toEqual([
      {
        path: "src/app.tsx",
        status: "M",
        displayPath: "src/app.tsx",
      },
      {
        path: "new-name.ts",
        status: "R",
        displayPath: "new-name.ts (from old-name.ts)",
      },
      {
        path: "scripts/new-file.ts",
        status: "??",
        displayPath: "scripts/new-file.ts",
      },
    ]);
  });

  it("parses git diff --name-status output for modified, added, and deleted files", () => {
    expect(
      parseGitDiffNameStatus(
        "M\0src/app.tsx\0A\0scripts/new-file.ts\0D\0src/old-file.ts\0",
      ),
    ).toEqual([
      {
        path: "src/app.tsx",
        status: "M",
        displayPath: "src/app.tsx",
      },
      {
        path: "scripts/new-file.ts",
        status: "A",
        displayPath: "scripts/new-file.ts",
      },
      {
        path: "src/old-file.ts",
        status: "D",
        displayPath: "src/old-file.ts",
      },
    ]);
  });

  it("parses git diff --name-status rename and copy entries", () => {
    expect(
      parseGitDiffNameStatus(
        "R100\0src/old-name.ts\0src/new-name.ts\0C100\0templates/source.ts\0templates/copied.ts\0",
      ),
    ).toEqual([
      {
        path: "src/new-name.ts",
        status: "R100",
        displayPath: "src/new-name.ts (from src/old-name.ts)",
      },
      {
        path: "templates/copied.ts",
        status: "C100",
        displayPath: "templates/copied.ts (from templates/source.ts)",
      },
    ]);
  });
});
