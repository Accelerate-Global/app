import { describe, expect, it } from "vitest";

import {
  getPrivateDataChatSemanticGuidanceFindings,
  PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE,
  PRIVATE_DATA_CHAT_UUPG_GUIDANCE,
} from "@/lib/private-data-chat/semantic-guidance";

describe("private data chat semantic guidance", () => {
  it("reconciles the global-engagement direction with the typed source contract", () => {
    expect(getPrivateDataChatSemanticGuidanceFindings()).toEqual([]);
    expect(PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.valueMeanings.true).toMatch(
      /explicitly recorded/,
    );
    expect(PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.valueMeanings.null).toMatch(
      /not false/,
    );
    expect(PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.conflictPolicy).toMatch(
      /excluded from retrieval/,
    );
  });

  it("freezes the null-preserving UUPG meaning and Baseline distinction", () => {
    expect(
      PRIVATE_DATA_CHAT_UUPG_GUIDANCE.defaultCriteria.globalEngagementAnywhere
        .matches,
    ).toEqual([false, null]);
    expect(
      PRIVATE_DATA_CHAT_UUPG_GUIDANCE.defaultCriteria.frontierGroup.matches,
    ).toEqual([true, null]);
    expect(PRIVATE_DATA_CHAT_UUPG_GUIDANCE.nullPreservingRationale).toMatch(
      /not an affirmative classification/,
    );
    expect(PRIVATE_DATA_CHAT_UUPG_GUIDANCE.baselineDistinction).toMatch(
      /not the separately versioned Baseline UUPG pipeline/,
    );
  });
});
