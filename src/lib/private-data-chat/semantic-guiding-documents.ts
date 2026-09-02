import {
  rebuildPrivateDataChatSemanticCard,
  rebuildPrivateDataChatSemanticContextPackage,
  validatePrivateDataChatSemanticCards,
  type PrivateDataChatSemanticContextFinding,
  type PrivateDataChatSemanticContextPackage,
} from "@/lib/private-data-chat/semantic-context";

const CARD_BLOCK =
  /<!-- SEMANTIC-CARD key=("(?:[^"\\]|\\.)*") checksum=("[0-9a-f]{64}") -->\n## [^\n]+\n\nAuthority: `([^`]+)`\n\nDefinition:\n([\s\S]*?)\n\nAliases:\n(\[[^\n]*\])\n\n<!-- END SEMANTIC-CARD ([a-z0-9._-]+) -->/gu;

type ParsedCardBlock = Readonly<{
  key: string;
  checksum: string;
  authority: string;
  definition: string;
  aliases: string[];
  endingKey: string;
}>;

function parseBlocks(document: string) {
  const blocks: ParsedCardBlock[] = [];
  const findings: PrivateDataChatSemanticContextFinding[] = [];
  let match: RegExpExecArray | null;

  while ((match = CARD_BLOCK.exec(document))) {
    try {
      const key = JSON.parse(match[1]!) as unknown;
      const checksum = JSON.parse(match[2]!) as unknown;
      const aliases = JSON.parse(match[5]!) as unknown;
      if (
        typeof key !== "string" ||
        typeof checksum !== "string" ||
        !Array.isArray(aliases) ||
        !aliases.every((value) => typeof value === "string")
      ) {
        throw new Error("Unsupported semantic card block.");
      }
      blocks.push({
        key,
        checksum,
        authority: match[3]!,
        definition: match[4]!.trim(),
        aliases,
        endingKey: match[6]!,
      });
    } catch {
      findings.push({
        severity: "error",
        ruleCode: "guiding-document-parse",
        message: "A semantic card block has unsupported or ambiguous structure.",
      });
    }
  }

  const markerCount = document.match(/<!-- SEMANTIC-CARD /gu)?.length ?? 0;
  if (markerCount !== blocks.length) {
    findings.push({
      severity: "error",
      ruleCode: "guiding-document-parse",
      message: "One or more semantic card markers could not be parsed unambiguously.",
    });
  }
  return { blocks, findings };
}

export function buildPrivateDataChatSemanticCandidateFromGuidingDocument(input: {
  base: PrivateDataChatSemanticContextPackage;
  document: string;
  expectedDefinitionPackageChecksum: string;
  sourceRetrievedAt: string;
}) {
  const parsed = parseBlocks(input.document);
  const findings = [...parsed.findings];
  if (
    input.base.definitionPackageChecksum !==
    input.expectedDefinitionPackageChecksum
  ) {
    findings.push({
      severity: "error",
      ruleCode: "semantic-concurrent-conflict",
      message:
        "The structured semantic package changed after the guiding-document edit began.",
    });
  }

  const blocksByKey = new Map<string, ParsedCardBlock>();
  for (const block of parsed.blocks) {
    if (blocksByKey.has(block.key)) {
      findings.push({
        severity: "error",
        ruleCode: "guiding-document-duplicate-card",
        stableEntryKey: block.key,
        message: "The guiding document contains a duplicate semantic card.",
      });
    }
    blocksByKey.set(block.key, block);
  }

  const changedKeys: string[] = [];
  const entries = input.base.entries.map((card) => {
    const block = blocksByKey.get(card.stableKey);
    if (!block) {
      findings.push({
        severity: "error",
        ruleCode: "guiding-document-missing-card",
        stableEntryKey: card.stableKey,
        message: "The guiding document omitted a structured semantic card.",
      });
      return card;
    }
    if (block.endingKey !== card.stableKey || block.checksum !== card.contentChecksum) {
      findings.push({
        severity: "error",
        ruleCode: "guiding-document-card-drift",
        stableEntryKey: card.stableKey,
        message: "The guiding document card identity/checksum does not match its base package.",
      });
      return card;
    }
    if (block.authority !== card.queryAuthority) {
      findings.push({
        severity: "error",
        ruleCode: "semantic-authority-widening",
        stableEntryKey: card.stableKey,
        fieldName: "queryAuthority",
        message: "Guiding-document edits cannot change query authority.",
      });
      return card;
    }
    if (
      block.definition !== card.definition ||
      JSON.stringify(block.aliases) !== JSON.stringify(card.aliases)
    ) {
      changedKeys.push(card.stableKey);
      return rebuildPrivateDataChatSemanticCard(card, {
        definition: block.definition,
        aliases: block.aliases,
      });
    }
    return card;
  });

  for (const key of blocksByKey.keys()) {
    if (!input.base.entries.some((card) => card.stableKey === key)) {
      findings.push({
        severity: "error",
        ruleCode: "guiding-document-unknown-card",
        stableEntryKey: key,
        message: "The guiding document introduced an unknown semantic card.",
      });
    }
  }

  findings.push(...validatePrivateDataChatSemanticCards(entries));
  if (findings.some((finding) => finding.severity === "error")) {
    return {
      candidate: null,
      changedKeys: Object.freeze(changedKeys),
      findings: Object.freeze(findings),
      requiresBlakeApproval: true,
    };
  }

  return {
    candidate: rebuildPrivateDataChatSemanticContextPackage({
      base: input.base,
      entries,
      sourceRetrievedAt: input.sourceRetrievedAt,
    }),
    changedKeys: Object.freeze(changedKeys),
    findings: Object.freeze(findings),
    requiresBlakeApproval: changedKeys.length > 0,
  };
}
