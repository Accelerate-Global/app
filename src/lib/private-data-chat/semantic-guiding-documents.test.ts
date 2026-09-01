import { describe, expect, it } from "vitest";

import {
  buildPrivateDataChatSemanticContextPackage,
  rebuildPrivateDataChatSemanticCard,
  rebuildPrivateDataChatSemanticContextPackage,
} from "@/lib/private-data-chat/semantic-context";
import { buildPrivateDataChatSemanticCandidateFromGuidingDocument } from "@/lib/private-data-chat/semantic-guiding-documents";

const sourceRetrievedAt = "2026-08-31T12:00:00.000Z";

describe("private data chat semantic guiding documents", () => {
  it("regenerates the guiding projection from a structured edit", () => {
    const base = buildPrivateDataChatSemanticContextPackage({
      sourceRetrievedAt,
    }).package;
    const target = base.entries.find((card) => card.stableKey === "field.country")!;
    const updated = rebuildPrivateDataChatSemanticContextPackage({
      base,
      entries: base.entries.map((card) =>
        card.stableKey === target.stableKey
          ? rebuildPrivateDataChatSemanticCard(card, {
              definition: `${card.definition} Reviewed extension.`,
            })
          : card,
      ),
    });

    expect(updated.guidingDocument).toContain("Reviewed extension.");
    expect(updated.guidingDocumentChecksum).not.toBe(
      base.guidingDocumentChecksum,
    );
    expect(updated.definitionPackageChecksum).not.toBe(
      base.definitionPackageChecksum,
    );
  });

  it("parses a supported document definition edit into one atomic candidate", () => {
    const base = buildPrivateDataChatSemanticContextPackage({
      sourceRetrievedAt,
    }).package;
    const document = base.guidingDocument.replace(
      "Canonical primary country name assigned to the people-group record; this is not a macro region or continent.",
      "Canonical primary country name for the people-group record; never a macro region or continent.",
    );
    const result = buildPrivateDataChatSemanticCandidateFromGuidingDocument({
      base,
      document,
      expectedDefinitionPackageChecksum: base.definitionPackageChecksum,
      sourceRetrievedAt: "2026-08-31T13:00:00.000Z",
    });

    expect(result.findings).toEqual([]);
    expect(result.changedKeys).toEqual(["field.country"]);
    expect(result.requiresBlakeApproval).toBe(true);
    expect(result.candidate?.guidingDocument).toContain(
      "never a macro region or continent",
    );
    expect(result.candidate?.definitionPackageChecksum).not.toBe(
      base.definitionPackageChecksum,
    );
  });

  it("blocks ambiguous parsing, concurrent conflict, and authority widening", () => {
    const base = buildPrivateDataChatSemanticContextPackage({
      sourceRetrievedAt,
    }).package;
    const ambiguous = buildPrivateDataChatSemanticCandidateFromGuidingDocument({
      base,
      document: `${base.guidingDocument}\n<!-- SEMANTIC-CARD broken -->`,
      expectedDefinitionPackageChecksum: "f".repeat(64),
      sourceRetrievedAt,
    });
    expect(ambiguous.candidate).toBeNull();
    expect(ambiguous.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "guiding-document-parse" }),
        expect.objectContaining({ ruleCode: "semantic-concurrent-conflict" }),
      ]),
    );

    const widened = buildPrivateDataChatSemanticCandidateFromGuidingDocument({
      base,
      document: base.guidingDocument.replace(
        "Authority: `explanatory-only`",
        "Authority: `queryable`",
      ),
      expectedDefinitionPackageChecksum: base.definitionPackageChecksum,
      sourceRetrievedAt,
    });
    expect(widened.candidate).toBeNull();
    expect(widened.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleCode: "semantic-authority-widening" }),
      ]),
    );
  });
});
