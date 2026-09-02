import { IMB_FIELD_CONTRACT } from "@/lib/imb-forming/field-contract";

export const PRIVATE_DATA_CHAT_SEMANTIC_GUIDANCE_VERSION = 1 as const;

export const PRIVATE_DATA_CHAT_UUPG_GUIDANCE = Object.freeze({
  key: "uupg",
  version: 1,
  label: "UUPG",
  definition:
    "Interactive null-preserving filter for people groups with no recorded positive global engagement and no recorded negative frontier classification.",
  defaultCriteria: Object.freeze({
    globalEngagementAnywhere: Object.freeze({
      field: "globally_engaged",
      matches: Object.freeze([false, null]),
      description:
        "Global Engagement Anywhere is false or blank. Blank is retained because it does not record the disqualifying true value.",
    }),
    frontierGroup: Object.freeze({
      field: "frontier_group",
      matches: Object.freeze([true, null]),
      description:
        "Frontier Group is true or blank. Blank is retained because it does not record the disqualifying false value.",
    }),
  }),
  nullPreservingRationale:
    "A blank value is not an affirmative classification. It remains so incomplete source data does not create a false exclusion.",
  baselineDistinction:
    "This interactive view is not the separately versioned Baseline UUPG pipeline, which applies stricter source-qualified conditions.",
} as const);

export const PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE = Object.freeze({
  conceptKey: "globally_engaged",
  canonicalFieldDefinitionKey: "engage_global_engagement_anywhere",
  sourceOutputField: "Engage_Global_Engagement_Anywhere",
  valueType: "boolean",
  definition:
    "Whether positive global engagement is recorded anywhere for the people group.",
  valueMeanings: Object.freeze({
    true: "Positive global engagement is explicitly recorded somewhere.",
    false: "No positive global engagement is explicitly recorded anywhere.",
    null: "The source value is missing or invalid; null is not false.",
  }),
  conflictPolicy:
    "The reviewed semantic overlay is authoritative for chat. Any mutable field-definition wording with the opposite boolean direction is excluded from retrieval and requires Blake's explicit conflict approval before activation.",
} as const);

export function getPrivateDataChatSemanticGuidanceFindings() {
  const source = IMB_FIELD_CONTRACT.find(
    (field) =>
      field.outputField ===
      PRIVATE_DATA_CHAT_GLOBAL_ENGAGEMENT_GUIDANCE.sourceOutputField,
  );
  const findings: string[] = [];

  if (!source) {
    findings.push("Global-engagement source field is missing from the IMB contract.");
  } else if (source.type !== "boolean") {
    findings.push("Global-engagement source field is not boolean.");
  }

  return findings;
}
