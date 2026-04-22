import { describe, expect, it } from "vitest";

import {
  findMissingRequiredWorkflowIssues,
  findSharedBootstrapActionIssues,
  findWorkflowBootstrapIssues,
} from "./check-workflow-bootstrap.mjs";

describe("check-workflow-bootstrap", () => {
  it("accepts workflows that use the shared bootstrap action for pnpm caching", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "app-quality.yml",
        content: `
jobs:
  app-quality:
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      - uses: ./.github/actions/setup-pnpm-node
      - run: pnpm install --frozen-lockfile
`,
      },
    ]);

    expect(issues).toEqual([]);
  });

  it("flags pnpm-cached workflows that bypass the shared bootstrap action", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "ui-smoke.yml",
        content: `
jobs:
  ui-smoke:
    steps:
      - uses: pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
      - run: pnpm install --frozen-lockfile
`,
      },
    ]);

    expect(issues).toEqual([
      "ui-smoke.yml: must use ./.github/actions/setup-pnpm-node.",
      "ui-smoke.yml: must not call pnpm/action-setup directly; use ./.github/actions/setup-pnpm-node instead.",
      "ui-smoke.yml: must not call actions/setup-node directly; use ./.github/actions/setup-pnpm-node instead.",
    ]);
  });

  it("flags required workflow files that are missing", () => {
    const issues = findMissingRequiredWorkflowIssues([
      { name: "app-quality.yml", content: "" },
      { name: "ui-smoke.yml", content: "" },
    ]);

    expect(issues).toEqual([
      "database-security.yml: required workflow file is missing.",
      "dependency-audit.yml: required workflow file is missing.",
    ]);
  });

  it("flags unpinned remote action refs in required workflows", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "dependency-audit.yml",
        content: `
jobs:
  dependency-audit:
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-pnpm-node
      - run: pnpm audit --audit-level=high
`,
      },
    ]);

    expect(issues).toEqual([
      "dependency-audit.yml: action ref actions/checkout@v4 must be pinned to a full commit SHA.",
    ]);
  });

  it("flags unpinned or misordered shared bootstrap steps", () => {
    const issues = findSharedBootstrapActionIssues(`
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
    - uses: pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa
`);

    expect(issues).toEqual([
      ".github/actions/setup-pnpm-node/action.yml: action ref actions/setup-node@v4 must be pinned to a full commit SHA.",
      ".github/actions/setup-pnpm-node/action.yml: must configure pnpm/action-setup before actions/setup-node.",
    ]);
  });

  it("ignores workflows that do not configure pnpm caching", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "docs.yml",
        content: `
jobs:
  docs:
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
`,
      },
    ]);

    expect(issues).toEqual([]);
  });
});
