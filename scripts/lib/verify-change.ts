import {
  resolveChangeImpact,
  type ChangeImpactResult,
  type ContractRequirementId,
} from "../../config/change-impact";
import type { UiSmokeContractIssue } from "./ui-smoke-contract";

export type VerifyChangeReport = ChangeImpactResult & {
  contractIssues: UiSmokeContractIssue[];
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
    exitCode: contractIssues.length > 0 ? 1 : 0,
  };
}
