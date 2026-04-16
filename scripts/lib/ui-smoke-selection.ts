import path from "node:path";

import { uiSmokeTargetRules } from "../../config/change-impact";
import { smokeRouteSpecs } from "../../tests/ui/route-registry";
import type { SmokeRole, SmokeRouteSpec } from "../../tests/ui/types";

export type UiSmokeSelection = {
  mode: "none" | "targeted" | "full";
  matchedRuleLabels: string[];
  routeIds: string[];
  journeyTitles: string[];
  projectNames: string[];
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

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function matchesAnyPattern(filePath: string, patterns: string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

function dedupeInOrder(items: string[], order: readonly string[]) {
  const present = new Set(items);
  return order.filter((item) => present.has(item));
}

function getProjectsForRole(role: SmokeRole) {
  return projectOrder.filter((projectName) => projectName.endsWith(`-${role}`));
}

function getRouteJourneys(route: SmokeRouteSpec | undefined) {
  return route?.journeys ?? [];
}

export function escapePlaywrightGrepPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildUiSmokeGrepPattern(selection: UiSmokeSelection) {
  const titles = [...selection.routeIds, ...selection.journeyTitles];

  if (titles.length === 0) {
    return null;
  }

  return `^(?:${titles.map(escapePlaywrightGrepPattern).join("|")})$`;
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
  const journeyTitles = [...new Set(routeIds.flatMap((routeId) => getRouteJourneys(routeById.get(routeId))))];
  const projectNames = dedupeInOrder(
    [
      ...routeIds.flatMap((routeId) => {
        const route = routeById.get(routeId);
        return route ? getProjectsForRole(route.role) : [];
      }),
      ...(journeyTitles.length > 0 ? ["desktop-admin"] : []),
    ],
    projectOrder,
  );

  if (routeIds.length === 0 && journeyTitles.length === 0) {
    return {
      mode: "none",
      matchedRuleLabels: matchedRules.map((rule) => rule.label),
      routeIds: [],
      journeyTitles: [],
      projectNames: [],
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

  return {
    mode: "targeted",
    matchedRuleLabels: matchedRules.map((rule) => rule.label),
    routeIds,
    journeyTitles,
    projectNames,
    command: "pnpm run test:ui:smoke:targeted",
    summary,
  };
}
