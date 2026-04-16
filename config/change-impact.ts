import path from "node:path";

export const verificationCommandCatalog = {
  typecheck: {
    id: "typecheck",
    command: "pnpm run typecheck",
    description: "TypeScript static analysis for repo code and scripts.",
  },
  "smoke:preflight": {
    id: "smoke:preflight",
    command: "pnpm run smoke:preflight",
    description:
      "Verify local Supabase, auth, storage, and smoke bootstrap prerequisites before Playwright starts.",
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
  "test:ui:smoke:targeted": {
    id: "test:ui:smoke:targeted",
    command: "pnpm run test:ui:smoke:targeted",
    description:
      "Run the current-worktree Playwright smoke subset before attempting the full suite.",
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

export type UiSmokeTargetRule = {
  id: string;
  label: string;
  patterns: string[];
  routeIds?: string[];
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
    recommendedCommands: ["test:ui:smoke:targeted"],
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
    recommendedCommands: ["test:ui:smoke:targeted"],
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
      "src/lib/field-definitions.ts",
      "src/lib/field-sources.ts",
      "src/lib/signup-allowlist.ts",
      "src/lib/supabase/**",
      "src/lib/user-management.ts",
      "src/lib/workspace-role.ts",
      "src/app/api/admin/users/**",
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

export const uiSmokeTargetRules: UiSmokeTargetRule[] = [
  {
    id: "ui-smoke-harness-full",
    label: "Smoke harness and browser runner changes",
    patterns: [
      ".github/workflows/ui-smoke.yml",
      "playwright.smoke.config.ts",
      "scripts/check-ui-smoke.ts",
      "scripts/check-ui-smoke-env.ts",
      "scripts/run-ui-smoke.ts",
      "scripts/smoke-bootstrap.ts",
      "tests/ui/**/*.ts",
      "tests/ui/**/*.tsx",
    ],
    forceFullSuite: true,
  },
  {
    id: "auth-entry-routes",
    label: "Anonymous auth entry routes",
    patterns: [
      "src/app/page.tsx",
      "src/app/sign-in/page.tsx",
      "src/app/sign-up/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/app/auth/confirm/**",
      "src/components/auth/auth-form.tsx",
      "src/components/auth/forgot-password-form.tsx",
      "src/components/auth/reset-password-form.tsx",
    ],
    routeIds: [
      "home-sign-in-anonymous",
      "sign-up-anonymous",
      "forgot-password-anonymous",
      "reset-password-anonymous",
      "sign-in-redirect-anonymous",
    ],
  },
  {
    id: "smoke-fixtures",
    label: "Shared UI fixtures and fixture gallery",
    patterns: [
      "src/app/%5F_smoke/components/**",
      "src/components/ui/**/*.ts",
      "src/components/ui/**/*.tsx",
    ],
    routeIds: ["smoke-components-anonymous"],
  },
  {
    id: "dashboard-shell",
    label: "Authenticated dashboard shell",
    patterns: [
      "src/components/layout/site-header.tsx",
      "src/components/auth/account-control.tsx",
      "src/components/dashboard/dashboard-client.tsx",
      "src/lib/auth.ts",
      "src/lib/supabase/**",
    ],
    routeIds: [
      "dashboard-viewer",
      "dashboard-admin",
      "dataset-detail-viewer",
      "dataset-detail-admin",
      "field-definitions-viewer",
      "field-definitions-admin",
      "field-sources-admin",
      "filter-settings-admin",
      "profile-viewer",
      "profile-admin",
      "user-management-admin",
      "upload-admin",
    ],
  },
  {
    id: "datasets",
    label: "Dashboard datasets and dataset detail flows",
    patterns: [
      "src/app/dashboard/page.tsx",
      "src/app/dashboard/datasets/**",
      "src/components/dashboard/datasets-grid.tsx",
      "src/components/dashboard/dashboard-client.tsx",
      "src/components/dashboard/dataset-detail-client.tsx",
      "src/components/dashboard/dataset-edit-sheet.tsx",
      "src/components/dashboard/dataset-table.tsx",
      "src/components/dashboard/dataset-tag-list.tsx",
      "src/components/dashboard/dataset-view-switch-grid.tsx",
      "src/lib/dataset-*.ts",
      "src/app/api/datasets/**",
    ],
    routeIds: [
      "dashboard-viewer",
      "dashboard-admin",
      "datasets-index-viewer",
      "datasets-index-admin",
      "dataset-detail-viewer",
      "dataset-detail-admin",
    ],
  },
  {
    id: "field-definitions",
    label: "Field Definitions routes and edit flow",
    patterns: [
      "src/app/dashboard/field-definitions/**",
      "src/components/dashboard/field-definition-*.tsx",
      "src/components/dashboard/field-definitions-client.tsx",
      "src/components/dashboard/field-source-tag-list.tsx",
      "src/lib/field-definition-*.ts",
      "src/lib/field-definitions.ts",
      "src/app/api/field-definitions/**",
    ],
    routeIds: ["field-definitions-viewer", "field-definitions-admin"],
  },
  {
    id: "field-sources",
    label: "Field Sources routes and source mapping flow",
    patterns: [
      "src/app/dashboard/field-sources/**",
      "src/components/dashboard/field-sources-client.tsx",
      "src/components/dashboard/field-source-tag-list.tsx",
      "src/lib/field-sources.ts",
      "src/app/api/field-sources/**",
      "src/app/api/field-source-types/**",
    ],
    routeIds: ["field-sources-viewer-redirect", "field-sources-admin"],
  },
  {
    id: "filter-settings",
    label: "Filter Settings routes and region editing flow",
    patterns: [
      "src/app/dashboard/filter-settings/**",
      "src/components/dashboard/filter-settings-client.tsx",
      "src/lib/filter-settings.ts",
      "src/app/api/filter-settings/**",
    ],
    routeIds: ["filter-settings-viewer-redirect", "filter-settings-admin"],
  },
  {
    id: "profile",
    label: "Profile and account settings",
    patterns: [
      "src/app/dashboard/profile/**",
      "src/components/auth/account-profile-form.tsx",
      "src/app/api/account/**",
    ],
    routeIds: ["profile-viewer", "profile-admin"],
  },
  {
    id: "user-management",
    label: "User Management route and admin account controls",
    patterns: [
      "src/app/dashboard/user-management/**",
      "src/components/dashboard/user-management-client.tsx",
      "src/components/auth/account-control.tsx",
      "src/lib/user-management.ts",
      "src/lib/workspace-role.ts",
      "src/app/api/admin/users/**",
      "src/app/api/account/disable/**",
    ],
    routeIds: ["user-management-viewer-redirect", "user-management-admin"],
  },
  {
    id: "upload",
    label: "Upload route and dataset replacement flow",
    patterns: [
      "src/app/dashboard/upload/**",
      "src/components/dashboard/dataset-upload-client.tsx",
      "src/app/api/blob/**",
    ],
    routeIds: ["upload-viewer-redirect", "upload-admin"],
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
