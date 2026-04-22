import path from "node:path";

import manifest from "./change-impact.manifest.json";

export type SupabaseLifecycle = "none" | "runner-managed" | "self-managed";

export const verificationCommandCatalog = {
  typecheck: {
    id: "typecheck",
    command: "pnpm run typecheck",
    description: "TypeScript static analysis for repo code and scripts.",
    supabaseLifecycle: "none",
  },
  "verify:test-delta": {
    id: "verify:test-delta",
    command: "pnpm run verify:test-delta",
    description:
      "Require a test file delta when directly tested repo code changes in the current diff.",
    supabaseLifecycle: "none",
  },
  "smoke:preflight": {
    id: "smoke:preflight",
    command: "pnpm run smoke:preflight",
    description:
      "Verify local Supabase, auth, storage, and smoke bootstrap prerequisites before Playwright starts.",
    supabaseLifecycle: "none",
  },
  "verify:app": {
    id: "verify:app",
    command: "pnpm run verify:app",
    description: "Run the repo app verification bundle: lint, vitest, and Next build.",
    supabaseLifecycle: "none",
  },
  "smoke:check": {
    id: "smoke:check",
    command: "pnpm run smoke:check",
    description: "Regenerate the shared UI smoke fixture manifest and validate smoke contracts.",
    supabaseLifecycle: "none",
  },
  "test:ui:smoke": {
    id: "test:ui:smoke",
    command: "pnpm run test:ui:smoke",
    description: "Run the full Playwright UI smoke suite against the local stack.",
    supabaseLifecycle: "runner-managed",
  },
  "test:ui:smoke:targeted": {
    id: "test:ui:smoke:targeted",
    command: "pnpm run test:ui:smoke:targeted",
    description:
      "Run the current-worktree Playwright smoke subset before attempting the full suite.",
    supabaseLifecycle: "runner-managed",
  },
  "db:security": {
    id: "db:security",
    command: "pnpm run db:security",
    description: "Reset local Supabase and run the database security suite.",
    supabaseLifecycle: "self-managed",
  },
  "db:check-migration-drift": {
    id: "db:check-migration-drift",
    command: "pnpm run db:check-migration-drift",
    description: "Check linked Supabase migration drift before release work.",
    supabaseLifecycle: "none",
  },
  "verify:ship:local": {
    id: "verify:ship:local",
    command: "pnpm run verify:ship:local",
    description: "Require a passing ship-local verification receipt before merge work begins.",
    supabaseLifecycle: "none",
  },
} as const;

export const manualStepCatalog = {
  "db:push:remote": {
    id: "db:push:remote",
    command: "pnpm run db:push:remote",
    description:
      "Apply tracked Supabase migrations to the linked remote project before ship or deploy.",
  },
} as const;

export type VerificationCommandId = keyof typeof verificationCommandCatalog;
export type ManualStepId = keyof typeof manualStepCatalog;
export type ContractRequirementId =
  | "route-registry-entry"
  | "page-marker"
  | "page-ready-marker"
  | "shared-ui-fixture"
  | "smoke-surface-literals";
export type UiSmokeBootstrapScope =
  | "full"
  | "auth"
  | "datasets"
  | "admin-config";

export type UiSmokeTargetRule = {
  id: string;
  label: string;
  patterns: string[];
  routeIds?: string[];
  journeyTitles?: string[];
  projectNames?: string[];
  testPaths?: string[];
  bootstrapScope?: UiSmokeBootstrapScope;
  forceFullSuite?: boolean;
};

export type ChangeImpactDomain = {
  id: string;
  label: string;
  patterns: string[];
  requiredCommands: VerificationCommandId[];
  recommendedCommands: VerificationCommandId[];
  manualSteps: ManualStepId[];
  contractRequirements: ContractRequirementId[];
};

export type ChangeImpactResult = {
  changedFiles: string[];
  domains: ChangeImpactDomain[];
  requiredCommands: VerificationCommandId[];
  recommendedCommands: VerificationCommandId[];
  manualSteps: ManualStepId[];
  contractRequirements: ContractRequirementId[];
};

export type CiPreinstallSelection = {
  runAppQuality: boolean;
  runUiSmoke: boolean;
  runDatabaseSecurity: boolean;
  runDependencyAudit: boolean;
};

export type CiAppQualityTaskSelection = {
  lint: boolean;
  test: boolean;
  build: boolean;
};

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

export const changeImpactDomains = manifest.changeImpactDomains as ChangeImpactDomain[];
export const uiSmokeTargetRules = manifest.uiSmokeTargetRules as UiSmokeTargetRule[];

const ciPreinstallWorkflowPatterns = manifest.ci.preinstallWorkflows as {
  appQualityPatterns: string[];
  uiSmokePatterns: string[];
  databaseSecurityPatterns: string[];
  dependencyAuditPatterns: string[];
};
const ciAppQualityTaskPatterns = manifest.ci.appQualityTasks as {
  lintPatterns: string[];
  testPatterns: string[];
  buildPatterns: string[];
};

const verificationCommandOrder = Object.keys(
  verificationCommandCatalog,
) as VerificationCommandId[];
const manualStepOrder = Object.keys(manualStepCatalog) as ManualStepId[];
const contractRequirementOrder: ContractRequirementId[] = [
  "route-registry-entry",
  "page-marker",
  "page-ready-marker",
  "shared-ui-fixture",
  "smoke-surface-literals",
];

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function normalizeChangedFiles(changedFiles: string[]) {
  return [...new Set(changedFiles.map(normalizePath))].sort();
}

function dedupeInCatalogOrder<T extends string>(items: T[], order: readonly T[]) {
  const present = new Set(items);
  return order.filter((item) => present.has(item));
}

function matchesAnyPattern(filePath: string, patterns: readonly string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

function matchesChangedFiles(changedFiles: string[], patterns: readonly string[]) {
  return changedFiles.some((filePath) => matchesAnyPattern(filePath, patterns));
}

export function resolveChangeImpact(changedFiles: string[]): ChangeImpactResult {
  const normalizedChangedFiles = normalizeChangedFiles(changedFiles);
  const domains = changeImpactDomains.filter((domain) =>
    matchesChangedFiles(normalizedChangedFiles, domain.patterns),
  );

  return {
    changedFiles: normalizedChangedFiles,
    domains,
    requiredCommands: dedupeInCatalogOrder(
      domains.flatMap((domain) => domain.requiredCommands),
      verificationCommandOrder,
    ),
    recommendedCommands: dedupeInCatalogOrder(
      domains.flatMap((domain) => domain.recommendedCommands),
      verificationCommandOrder,
    ).filter((command) =>
      !domains.flatMap((domain) => domain.requiredCommands).includes(command),
    ),
    manualSteps: dedupeInCatalogOrder(
      domains.flatMap((domain) => domain.manualSteps),
      manualStepOrder,
    ),
    contractRequirements: dedupeInCatalogOrder(
      domains.flatMap((domain) => domain.contractRequirements),
      contractRequirementOrder,
    ),
  };
}

export function selectCiPreinstallValidation(changedFiles: string[]): CiPreinstallSelection {
  const normalizedChangedFiles = normalizeChangedFiles(changedFiles);

  return {
    runAppQuality: matchesChangedFiles(
      normalizedChangedFiles,
      ciPreinstallWorkflowPatterns.appQualityPatterns,
    ),
    runUiSmoke: matchesChangedFiles(
      normalizedChangedFiles,
      ciPreinstallWorkflowPatterns.uiSmokePatterns,
    ),
    runDatabaseSecurity: matchesChangedFiles(
      normalizedChangedFiles,
      ciPreinstallWorkflowPatterns.databaseSecurityPatterns,
    ),
    runDependencyAudit: matchesChangedFiles(
      normalizedChangedFiles,
      ciPreinstallWorkflowPatterns.dependencyAuditPatterns,
    ),
  };
}

export function selectCiAppQualityTasks(
  changedFiles: string[],
): CiAppQualityTaskSelection {
  const normalizedChangedFiles = normalizeChangedFiles(changedFiles);

  return {
    lint: matchesChangedFiles(
      normalizedChangedFiles,
      ciAppQualityTaskPatterns.lintPatterns,
    ),
    test: matchesChangedFiles(
      normalizedChangedFiles,
      ciAppQualityTaskPatterns.testPatterns,
    ),
    build: matchesChangedFiles(
      normalizedChangedFiles,
      ciAppQualityTaskPatterns.buildPatterns,
    ),
  };
}

export function shouldRunAppQualityOnCi(changedFiles: string[]) {
  return selectCiPreinstallValidation(changedFiles).runAppQuality;
}
