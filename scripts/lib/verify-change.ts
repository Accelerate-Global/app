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

export type VerifyChangeReport = ChangeImpactResult & {
  contractIssues: UiSmokeContractIssue[];
  targetedSmoke: UiSmokeSelection;
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
    exitCode: contractIssues.length > 0 ? 1 : 0,
  };
}
