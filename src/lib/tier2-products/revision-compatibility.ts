export type Tier2PublicationRevisionLineage = Readonly<{
  inputKey: string;
  publicationId: string;
  originRevisionNumber: number | null;
  bindingIds: readonly string[];
}>;

export type Tier2RevisionCompatibilityIssue = Readonly<{
  inputKey: string;
  publicationId: string;
  code: "missing-origin-revision" | "selected-revision-too-old" | "missing-binding";
  bindingId: string | null;
}>;

export function getTier2RevisionCompatibilityIssues(input: {
  selectedRevisionNumber: number;
  selectedBindingIds: ReadonlySet<string>;
  lineage: readonly Tier2PublicationRevisionLineage[];
}) {
  const issues: Tier2RevisionCompatibilityIssue[] = [];
  for (const publication of input.lineage) {
    if (publication.originRevisionNumber === null) {
      issues.push({
        inputKey: publication.inputKey,
        publicationId: publication.publicationId,
        code: "missing-origin-revision",
        bindingId: null,
      });
      continue;
    }
    if (publication.originRevisionNumber > input.selectedRevisionNumber) {
      issues.push({
        inputKey: publication.inputKey,
        publicationId: publication.publicationId,
        code: "selected-revision-too-old",
        bindingId: null,
      });
    }
    for (const bindingId of publication.bindingIds) {
      if (!input.selectedBindingIds.has(bindingId)) {
        issues.push({
          inputKey: publication.inputKey,
          publicationId: publication.publicationId,
          code: "missing-binding",
          bindingId,
        });
      }
    }
  }
  return issues;
}
