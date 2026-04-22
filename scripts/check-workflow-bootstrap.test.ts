import { describe, expect, it } from "vitest";

import {
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
      "ui-smoke.yml: runs pnpm commands but does not use ./.github/actions/setup-pnpm-node.",
      "ui-smoke.yml: must not call pnpm/action-setup directly; use ./.github/actions/setup-pnpm-node instead.",
      "ui-smoke.yml: must not call actions/setup-node directly; use ./.github/actions/setup-pnpm-node instead.",
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
