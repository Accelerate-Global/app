import {
  resolveChangeImpact,
  type ChangeImpactResult,
  type ContractRequirementId,
} from "../../config/change-impact";
import type { UiSmokeContractIssue } from "./ui-smoke-contract";
import {
  resolveUiSmokeSelection,
  type UiSmokeSelection,
} from "./ui-smoke-selection";
import type { TestDeltaReport } from "./test-impact";

export type VerifyChangeReport = ChangeImpactResult & {
  contractIssues: UiSmokeContractIssue[];
  targetedSmoke: UiSmokeSelection;
  testDelta: TestDeltaReport;
  exitCode: 0 | 1;
};

function filterContractIssues(
  contractRequirements: ContractRequirementId[],
  contractIssues: UiSmokeContractIssue[],
) {
  if (contractRequirements.length === 0) {
    return [];
  }

  const requirementSet = new Set(contractRequirements);
  return contractIssues.filter((issue) => requirementSet.has(issue.requirement));
}

export function createVerifyChangeReport(input: {
  changedFiles: string[];
  contractIssues: UiSmokeContractIssue[];
  testDelta: TestDeltaReport;
}): VerifyChangeReport {
  const impact = resolveChangeImpact(input.changedFiles);
  const contractIssues = filterContractIssues(
    impact.contractRequirements,
    input.contractIssues,
  );

  return {
    ...impact,
    contractIssues,
    targetedSmoke: resolveUiSmokeSelection(input.changedFiles),
    testDelta: input.testDelta,
    exitCode: contractIssues.length > 0 || input.testDelta.exitCode !== 0 ? 1 : 0,
  };
}
