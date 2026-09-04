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
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
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
        name: "app-quality.yml",
        content: `
jobs:
  app-quality:
    steps:
      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
      - run: pnpm install --frozen-lockfile
`,
      },
    ]);

    expect(issues).toEqual([
      "app-quality.yml: must use ./.github/actions/setup-pnpm-node.",
      "app-quality.yml: must not call pnpm/action-setup directly; use ./.github/actions/setup-pnpm-node instead.",
      "app-quality.yml: must not call actions/setup-node directly; use ./.github/actions/setup-pnpm-node instead.",
    ]);
  });

  it("accepts UI smoke sanitized result artifact uploads", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "ui-smoke.yml",
        content: `
jobs:
  ui-smoke:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: ./.github/actions/setup-pnpm-node
      - if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: ui-smoke-results
          path: output/playwright/safe-smoke-results/results.json
          if-no-files-found: ignore
          retention-days: 7
`,
      },
    ]);

    expect(issues).toEqual([]);
  });

  it("flags unsafe UI smoke artifact uploads", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "ui-smoke.yml",
        content: `
jobs:
  ui-smoke:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: ./.github/actions/setup-pnpm-node
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: ui-smoke-report
          path: |
            output/playwright/ui-smoke
            test-results/ui-smoke
            trace.zip
            screenshot.png
            video.webm
`,
      },
    ]);

    expect(issues).toEqual([
      "ui-smoke.yml: UI smoke artifact must be named ui-smoke-results.",
      "ui-smoke.yml: UI smoke artifact path must be output/playwright/safe-smoke-results/results.json.",
      "ui-smoke.yml: UI smoke artifact retention must be 7 days.",
      "ui-smoke.yml: must not use multi-path artifact uploads.",
      "ui-smoke.yml: must not upload Playwright test-results.",
      "ui-smoke.yml: must not upload the HTML report directory.",
      "ui-smoke.yml: must not upload Playwright trace archives.",
      "ui-smoke.yml: must not upload screenshots or videos.",
    ]);
  });

  it("rejects additional UI smoke artifact uploads or path keys", () => {
    const issues = findWorkflowBootstrapIssues([
      {
        name: "ui-smoke.yml",
        content: `
jobs:
  ui-smoke:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: ./.github/actions/setup-pnpm-node
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: ui-smoke-results
          path: output/playwright/safe-smoke-results/results.json
          path: output/extra-summary.json
          retention-days: 7
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
        with:
          name: extra-results
          path: output/extra-summary.json
          retention-days: 7
`,
      },
    ]);

    expect(issues).toEqual([
      "ui-smoke.yml: must define exactly one sanitized UI smoke artifact upload.",
      "ui-smoke.yml: must define exactly one UI smoke artifact path.",
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
    - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86
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
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
`,
      },
    ]);

    expect(issues).toEqual([]);
  });
});
