import { describe, expect, it } from "vitest";

import {
  pipelineBackfillSchema,
  pipelineLaunchSchema,
  pipelineRebuildSchema,
} from "./schemas";

const requestId = "00000000-0000-4000-8000-000000000001";

describe("pipeline launch schemas", () => {
  it("accepts only a manual launch without client-owned exact inputs", () => {
    expect(
      pipelineLaunchSchema.safeParse({
        definitionKey: "source-imb-people-groups",
        launchKind: "manual",
        requestId,
      }).success,
    ).toBe(true);
    expect(
      pipelineLaunchSchema.safeParse({
        definitionKey: "source-imb-people-groups",
        launchKind: "manual",
        requestId,
        exactInputs: { resourceSetId: "client-controlled" },
      }).success,
    ).toBe(false);
    expect(
      pipelineLaunchSchema.safeParse({
        definitionKey: "source-imb-people-groups",
        launchKind: "backfill",
        requestId,
      }).success,
    ).toBe(false);
  });

  it("keeps explicit historical inputs exclusive to the backfill schema", () => {
    expect(
      pipelineBackfillSchema.safeParse({
        definitionKey: "source-imb-people-groups",
        requestId,
        exactInputs: {
          referenceVersionIds: {
            countryId: "10000000-0000-4000-8000-000000000001",
          },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects injected exact inputs on rebuild", () => {
    expect(
      pipelineRebuildSchema.safeParse({
        requestId,
        exactInputs: { resourceSetId: "client-controlled" },
      }).success,
    ).toBe(false);
  });
});
