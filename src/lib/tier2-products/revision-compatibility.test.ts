import { describe, expect, it } from "vitest";

import { getTier2RevisionCompatibilityIssues } from "./revision-compatibility";

describe("Tier 2 release registry revision compatibility", () => {
  it("allows sequential partner publications in one later revision that retains every binding", () => {
    expect(getTier2RevisionCompatibilityIssues({
      selectedRevisionNumber: 3,
      selectedBindingIds: new Set(["alpha-binding", "beta-binding"]),
      lineage: [
        {
          inputKey: "alpha",
          publicationId: "alpha-publication-r1",
          originRevisionNumber: 1,
          bindingIds: ["alpha-binding"],
        },
        {
          inputKey: "beta",
          publicationId: "beta-publication-r2",
          originRevisionNumber: 2,
          bindingIds: ["beta-binding"],
        },
      ],
    })).toEqual([]);
  });

  it("allows nested Aggregate 2 lineage only when the final revision contains all exact bindings", () => {
    const lineage = [
      {
        inputKey: "tier2",
        publicationId: "tier2-r3",
        originRevisionNumber: 3,
        bindingIds: ["alpha-binding", "beta-binding"],
      },
      {
        inputKey: "imb",
        publicationId: "imb-r1",
        originRevisionNumber: 1,
        bindingIds: ["imb-binding"],
      },
      {
        inputKey: "jp",
        publicationId: "jp-r2",
        originRevisionNumber: 2,
        bindingIds: ["jp-binding"],
      },
    ] as const;
    expect(getTier2RevisionCompatibilityIssues({
      selectedRevisionNumber: 4,
      selectedBindingIds: new Set([
        "alpha-binding",
        "beta-binding",
        "imb-binding",
        "jp-binding",
      ]),
      lineage,
    })).toEqual([]);
    expect(getTier2RevisionCompatibilityIssues({
      selectedRevisionNumber: 4,
      selectedBindingIds: new Set(["alpha-binding", "beta-binding", "imb-binding"]),
      lineage,
    })).toContainEqual(expect.objectContaining({
      inputKey: "jp",
      code: "missing-binding",
      bindingId: "jp-binding",
    }));
  });
});
