import { describe, expect, it } from "vitest";

import { evaluateUiSmokeContracts } from "./ui-smoke-contract";

const baseInput = {
  pageFiles: ["src/app/example/page.tsx"],
  routeSpecs: [
    {
      id: "example-route",
      role: "anonymous" as const,
      pageFile: "src/app/example/page.tsx",
      path: "/example",
      pageId: "example-page",
    },
  ],
  uiComponentFiles: ["src/components/ui/button.tsx"],
  uiFixtureFiles: ["src/components/ui/button.smoke.tsx"],
  fileAttributeState: {
    "src/app/example/page.tsx": {
      pageIds: ["example-page"],
      pageReadyIds: ["example-page"],
      triggerIds: [],
      surfaceIds: [],
      readyIds: [],
      closeIds: [],
    },
  },
};

describe("ui-smoke-contract", () => {
  it("reports a missing route registry entry", () => {
    const report = evaluateUiSmokeContracts({
      ...baseInput,
      routeSpecs: [],
    });

    expect(report.issues).toContainEqual({
      requirement: "route-registry-entry",
      message: "Missing smoke route entry for src/app/example/page.tsx",
    });
  });

  it("reports a missing page marker", () => {
    const report = evaluateUiSmokeContracts({
      ...baseInput,
      fileAttributeState: {
        "src/app/example/page.tsx": {
          ...baseInput.fileAttributeState["src/app/example/page.tsx"],
          pageIds: [],
        },
      },
    });

    expect(report.issues).toContainEqual({
      requirement: "page-marker",
      message:
        'Missing data-smoke-page="example-page" marker in src/app/example/page.tsx',
    });
  });

  it("reports a missing page-ready marker", () => {
    const report = evaluateUiSmokeContracts({
      ...baseInput,
      fileAttributeState: {
        "src/app/example/page.tsx": {
          ...baseInput.fileAttributeState["src/app/example/page.tsx"],
          pageReadyIds: [],
        },
      },
    });

    expect(report.issues).toContainEqual({
      requirement: "page-ready-marker",
      message:
        'Missing data-smoke-page-ready="example-page" marker in src/app/example/page.tsx',
    });
  });

  it("reports a missing shared UI smoke fixture", () => {
    const report = evaluateUiSmokeContracts({
      ...baseInput,
      uiFixtureFiles: [],
    });

    expect(report.issues).toContainEqual({
      requirement: "shared-ui-fixture",
      message:
        "Missing shared UI smoke fixture src/components/ui/button.smoke.tsx",
    });
  });
});
