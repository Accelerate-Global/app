import path from "node:path";

import {
  uiSmokeTargetRules,
  type UiSmokeBootstrapScope,
} from "../../config/change-impact";
import { smokeRouteSpecs } from "../../tests/ui/route-registry";

export type UiSmokeSelection = {
  mode: "none" | "targeted" | "full";
  matchedRuleLabels: string[];
  routeIds: string[];
  journeyTitles: string[];
  projectNames: string[];
  bootstrapScope: UiSmokeBootstrapScope | null;
  command: string | null;
  summary: string[];
};

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

const routeById = new Map(smokeRouteSpecs.map((route) => [route.id, route]));
const routeIdOrder = smokeRouteSpecs.map((route) => route.id);
const projectOrder = [
  "desktop-anonymous",
  "desktop-viewer",
  "desktop-admin",
  "mobile-anonymous",
  "mobile-viewer",
  "mobile-admin",
] as const;
const bootstrapScopeOrder: UiSmokeBootstrapScope[] = [
  "auth",
  "datasets",
  "admin-config",
  "full",
] as const;

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function matchesAnyPattern(filePath: string, patterns: string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

function dedupeInOrder<T extends string>(items: T[], order: readonly T[]) {
  const present = new Set(items);
  return order.filter((item) => present.has(item));
}

function resolveBootstrapScope(
  matchedRules: typeof uiSmokeTargetRules,
): UiSmokeBootstrapScope {
  const configuredScopes = dedupeInOrder(
    matchedRules.map((rule) => rule.bootstrapScope ?? "full"),
    bootstrapScopeOrder,
  );

  if (configuredScopes.length === 1) {
    return configuredScopes[0] ?? "full";
  }

  return "full";
}

function getDefaultProjectNames(routeIds: string[]) {
  return dedupeInOrder(
    routeIds.flatMap((routeId) => {
      const route = routeById.get(routeId);

      if (!route) {
        return [];
      }

      return [`desktop-${route.role}`];
    }),
    projectOrder,
  );
}

export function escapePlaywrightGrepPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildUiSmokeGrepPattern(selection: UiSmokeSelection) {
  const titles = [...selection.routeIds, ...selection.journeyTitles];

  if (titles.length === 0) {
    return null;
  }

  return `(?:${titles.map(escapePlaywrightGrepPattern).join("|")})`;
}

export function formatUiSmokeZeroMatchMessage(input: {
  grepPattern: string;
  selection: UiSmokeSelection;
}) {
  const details = [
    "Targeted UI smoke selection matched zero Playwright tests.",
    `Grep pattern: ${input.grepPattern}`,
  ];

  if (input.selection.routeIds.length > 0) {
    details.push(`Routes: ${input.selection.routeIds.join(", ")}`);
  }

  if (input.selection.journeyTitles.length > 0) {
    details.push(`Journeys: ${input.selection.journeyTitles.join(", ")}`);
  }

  if (input.selection.projectNames.length > 0) {
    details.push(`Projects: ${input.selection.projectNames.join(", ")}`);
  }

  return details.join("\n");
}

export function resolveUiSmokeSelection(changedFiles: string[]): UiSmokeSelection {
  const normalizedChangedFiles = [...new Set(changedFiles.map(normalizePath))].sort();

  if (normalizedChangedFiles.length === 0) {
    return {
      mode: "none",
      matchedRuleLabels: [],
      routeIds: [],
      journeyTitles: [],
      projectNames: [],
      bootstrapScope: null,
      command: null,
      summary: [],
    };
  }

  const matchedRules = uiSmokeTargetRules.filter((rule) =>
    normalizedChangedFiles.some((filePath) => matchesAnyPattern(filePath, rule.patterns)),
  );

  if (matchedRules.some((rule) => rule.forceFullSuite)) {
    return {
      mode: "full",
      matchedRuleLabels: matchedRules.map((rule) => rule.label),
      routeIds: [],
      journeyTitles: [],
      projectNames: [...projectOrder],
      bootstrapScope: "full",
      command: "pnpm run test:ui:smoke",
      summary: [
        "Full suite required because the smoke harness or browser runner changed.",
      ],
    };
  }

  const routeIds = dedupeInOrder(
    matchedRules.flatMap((rule) => rule.routeIds ?? []),
    routeIdOrder,
  );
  const journeyTitles = [...new Set(matchedRules.flatMap((rule) => rule.journeyTitles ?? []))];
  const explicitProjectNames = dedupeInOrder(
    [...new Set(matchedRules.flatMap((rule) => rule.projectNames ?? []))],
    projectOrder,
  );
  const projectNames =
    explicitProjectNames.length > 0
      ? explicitProjectNames
      : getDefaultProjectNames(routeIds);
  const bootstrapScope = resolveBootstrapScope(matchedRules);

  if (routeIds.length === 0 && journeyTitles.length === 0) {
    return {
      mode: "none",
      matchedRuleLabels: matchedRules.map((rule) => rule.label),
      routeIds: [],
      journeyTitles: [],
      projectNames: [],
      bootstrapScope: null,
      command: null,
      summary: [],
    };
  }

  const summary: string[] = [];

  if (matchedRules.length > 0) {
    summary.push(`Matched areas: ${matchedRules.map((rule) => rule.label).join(", ")}`);
  }

  if (routeIds.length > 0) {
    summary.push(`Routes: ${routeIds.join(", ")}`);
  }

  if (journeyTitles.length > 0) {
    summary.push(`Journeys: ${journeyTitles.join(", ")}`);
  }

  if (projectNames.length > 0) {
    summary.push(`Projects: ${projectNames.join(", ")}`);
  }

  summary.push(`Bootstrap scope: ${bootstrapScope}`);

  return {
    mode: "targeted",
    matchedRuleLabels: matchedRules.map((rule) => rule.label),
    routeIds,
    journeyTitles,
    projectNames,
    bootstrapScope,
    command: "pnpm run test:ui:smoke:targeted",
    summary,
  };
}
