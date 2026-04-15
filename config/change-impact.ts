import path from "node:path";

export const verificationCommandCatalog = {
  typecheck: {
    id: "typecheck",
    command: "pnpm run typecheck",
    description: "TypeScript static analysis for repo code and scripts.",
  },
  "verify:app": {
    id: "verify:app",
    command: "pnpm run verify:app",
    description: "Run the repo app verification bundle: lint, vitest, and Next build.",
  },
  "smoke:check": {
    id: "smoke:check",
    command: "pnpm run smoke:check",
    description: "Regenerate the shared UI smoke fixture manifest and validate smoke contracts.",
  },
  "test:ui:smoke": {
    id: "test:ui:smoke",
    command: "pnpm run test:ui:smoke",
    description: "Run the full Playwright UI smoke suite against the local stack.",
  },
  "db:security": {
    id: "db:security",
    command: "pnpm run db:security",
    description: "Reset local Supabase and run the database security suite.",
  },
  "db:check-migration-drift": {
    id: "db:check-migration-drift",
    command: "pnpm run db:check-migration-drift",
    description: "Check linked Supabase migration drift before release work.",
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

export type ChangeImpactDomain = {
  id: string;
  label: string;
  patterns: string[];
  requiredCommands: VerificationCommandId[];
  recommendedCommands: VerificationCommandId[];
  manualSteps: ManualStepId[];
  contractRequirements: ContractRequirementId[];
};

export const changeImpactDomains: ChangeImpactDomain[] = [
  {
    id: "planner-policy",
    label: "Planner policy and agent workflow",
    patterns: [
      "AGENTS.md",
      "config/**/*.ts",
      "scripts/verify-change.ts",
      "scripts/lib/verify-change.ts",
    ],
    requiredCommands: ["typecheck"],
    recommendedCommands: ["verify:app"],
    manualSteps: [],
    contractRequirements: [],
  },
  {
    id: "app-runtime",
    label: "Application and script runtime",
    patterns: [
      "package.json",
      "scripts/**/*.ts",
      "src/app/**/*.ts",
      "src/app/**/*.tsx",
      "src/components/**/*.ts",
      "src/components/**/*.tsx",
      "src/db/**/*.ts",
      "src/db/**/*.tsx",
      "src/lib/**/*.ts",
      "src/lib/**/*.tsx",
      "tests/**/*.ts",
      "tests/**/*.tsx",
    ],
    requiredCommands: ["typecheck", "verify:app"],
    recommendedCommands: [],
    manualSteps: [],
    contractRequirements: [],
  },
  {
    id: "ui-pages",
    label: "Smoke-tracked App Router pages",
    patterns: ["src/app/**/page.tsx"],
    requiredCommands: ["smoke:check"],
    recommendedCommands: ["test:ui:smoke"],
    manualSteps: [],
    contractRequirements: [
      "route-registry-entry",
      "page-marker",
      "page-ready-marker",
      "smoke-surface-literals",
    ],
  },
  {
    id: "ui-primitives",
    label: "Shared UI primitives",
    patterns: ["src/components/ui/**/*.ts", "src/components/ui/**/*.tsx"],
    requiredCommands: ["smoke:check"],
    recommendedCommands: [],
    manualSteps: [],
    contractRequirements: ["shared-ui-fixture", "smoke-surface-literals"],
  },
  {
    id: "ui-smoke-harness",
    label: "UI smoke harness and fixtures",
    patterns: [
      ".github/workflows/ui-smoke.yml",
      "README.md",
      "docs/testing/ui-smoke.md",
      "playwright.smoke.config.ts",
      "scripts/check-ui-smoke.ts",
      "scripts/run-ui-smoke.ts",
      "scripts/smoke-bootstrap.ts",
      "tests/ui/**/*.ts",
      "tests/ui/**/*.tsx",
    ],
    requiredCommands: ["smoke:check", "test:ui:smoke"],
    recommendedCommands: [],
    manualSteps: [],
    contractRequirements: [
      "route-registry-entry",
      "page-marker",
      "page-ready-marker",
      "shared-ui-fixture",
      "smoke-surface-literals",
    ],
  },
  {
    id: "database-security",
    label: "Database access and security",
    patterns: [
      ".github/workflows/database-security.yml",
      "scripts/check-public-rls.mjs",
      "scripts/run-remote-db-tests.mjs",
      "src/db/**",
      "src/lib/auth.ts",
      "src/lib/dataset-access.ts",
      "src/lib/field-definitions.ts",
      "src/lib/field-sources.ts",
      "src/lib/signup-allowlist.ts",
      "src/lib/supabase/**",
      "supabase/**",
    ],
    requiredCommands: ["db:security"],
    recommendedCommands: [],
    manualSteps: [],
    contractRequirements: [],
  },
  {
    id: "database-migrations",
    label: "Tracked Supabase migrations",
    patterns: ["supabase/migrations/**"],
    requiredCommands: ["db:security", "db:check-migration-drift"],
    recommendedCommands: [],
    manualSteps: ["db:push:remote"],
    contractRequirements: [],
  },
];

export type ChangeImpactResult = {
  changedFiles: string[];
  domains: ChangeImpactDomain[];
  requiredCommands: VerificationCommandId[];
  recommendedCommands: VerificationCommandId[];
  manualSteps: ManualStepId[];
  contractRequirements: ContractRequirementId[];
};

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

function dedupeInCatalogOrder<T extends string>(items: T[], order: readonly T[]) {
  const present = new Set(items);
  return order.filter((item) => present.has(item));
}

function matchesAnyPattern(filePath: string, patterns: string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

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

export function resolveChangeImpact(changedFiles: string[]): ChangeImpactResult {
  const normalizedChangedFiles = [...new Set(changedFiles.map(normalizePath))].sort();
  const domains = changeImpactDomains.filter((domain) =>
    normalizedChangedFiles.some((filePath) => matchesAnyPattern(filePath, domain.patterns)),
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
