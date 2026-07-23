import { describe, expect, it } from "vitest";

import {
  publishPipelineRunSchema,
  rollbackPipelineProductTargetSchema,
} from "./validation";

describe("pipeline publication validation", () => {
  it("requires the stable target publication pinned when the candidate was built", () => {
    expect(publishPipelineRunSchema.safeParse({
      reason: "Reviewed candidate",
      acknowledgeWarnings: false,
    }).success).toBe(false);

    expect(publishPipelineRunSchema.safeParse({
      reason: "Reviewed candidate",
      acknowledgeWarnings: false,
      expectedCurrentPublicationId: null,
    }).success).toBe(true);

    expect(publishPipelineRunSchema.safeParse({
      reason: "Reviewed candidate",
      acknowledgeWarnings: true,
      expectedCurrentPublicationId: "85000000-0000-4000-8000-000000000040",
    }).success).toBe(true);
  });

  it("requires exact current and retained publication ids for rollback", () => {
    expect(rollbackPipelineProductTargetSchema.safeParse({
      reason: "Restore retained publication",
      publicationId: "85000000-0000-4000-8000-000000000041",
    }).success).toBe(false);

    expect(rollbackPipelineProductTargetSchema.safeParse({
      reason: "Restore retained publication",
      publicationId: "85000000-0000-4000-8000-000000000041",
      expectedCurrentPublicationId: "85000000-0000-4000-8000-000000000042",
    }).success).toBe(true);
  });
});
