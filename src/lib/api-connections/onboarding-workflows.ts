import { z } from "zod";

import type {
  GoogleSheetsWorkflowAssignment,
  Tier2WorkflowOwnerOption,
} from "@/lib/api-types";

const workflowKeyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

const optionalColumnSchema = z.string().trim().min(1).max(256).nullable();

export const googleSheetsWorkflowAssignmentSchema = z.discriminatedUnion("kind", [
  z.object({
    sheetId: z.number().int().nonnegative(),
    kind: z.literal("none"),
  }).strict(),
  z.object({
    sheetId: z.number().int().nonnegative(),
    kind: z.literal("tier1"),
    sourceProfileKey: z.enum([
      "accelerate-owned-people-groups",
      "wcd-people-groups",
    ]),
    stableKeyColumn: z.string().trim().min(1).max(256),
  }).strict(),
  z.object({
    sheetId: z.number().int().nonnegative(),
    kind: z.literal("tier2"),
    ownerKey: z.string().trim().regex(workflowKeyPattern),
    feedKey: z.string().trim().regex(workflowKeyPattern),
    feedName: z.string().trim().min(1).max(160),
    stableRowKeyColumn: z.string().trim().min(1).max(256),
    trackingIdColumn: z.string().trim().min(1).max(256),
    trackingIdSource: z.enum(["peopleid3", "peid", "rop3", "provider-native"]),
    sourceRop3Column: optionalColumnSchema,
    sourceCountryColumn: optionalColumnSchema,
    sourceIso3Column: optionalColumnSchema,
  }).strict(),
]);

export const googleSheetsWorkflowAssignmentsSchema = z
  .array(googleSheetsWorkflowAssignmentSchema)
  .max(50)
  .default([]);

export class OnboardingWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingWorkflowError";
  }
}

export function normalizeWorkflowKey(value: string) {
  const key = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96)
    .replace(/-+$/gu, "");
  return workflowKeyPattern.test(key) ? key : "";
}

export function buildTier2WorkflowOwnerOptions(
  entries: readonly {
    canonicalSourceKey: string;
    displayName: string;
    active: boolean;
  }[],
): Tier2WorkflowOwnerOption[] {
  return entries
    .filter((entry) => entry.active)
    .map((entry) => ({ key: entry.canonicalSourceKey, label: entry.displayName }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function assignmentColumns(assignment: GoogleSheetsWorkflowAssignment) {
  if (assignment.kind === "none") return [];
  if (assignment.kind === "tier1") return [assignment.stableKeyColumn];
  return [
    assignment.stableRowKeyColumn,
    assignment.trackingIdColumn,
    assignment.sourceRop3Column,
    assignment.sourceCountryColumn,
    assignment.sourceIso3Column,
  ].filter((column): column is string => Boolean(column));
}

export function validateGoogleSheetsWorkflowAssignments(input: {
  assignments: readonly GoogleSheetsWorkflowAssignment[];
  selectedSheetIds: readonly number[];
  headersBySheetId: ReadonlyMap<number, readonly string[]>;
}) {
  const selectedIds = new Set(input.selectedSheetIds);
  const bySheetId = new Map<number, GoogleSheetsWorkflowAssignment>();

  for (const assignment of input.assignments) {
    if (!selectedIds.has(assignment.sheetId)) {
      throw new OnboardingWorkflowError(
        "A workflow assignment references a Sheet tab that was not selected.",
      );
    }
    if (bySheetId.has(assignment.sheetId)) {
      throw new OnboardingWorkflowError(
        "Choose at most one workflow for each selected Sheet tab.",
      );
    }
    const headers = new Set(input.headersBySheetId.get(assignment.sheetId) ?? []);
    for (const column of assignmentColumns(assignment)) {
      if (!headers.has(column)) {
        throw new OnboardingWorkflowError(
          `Workflow column ${column} is not in the reviewed Sheet headers.`,
        );
      }
    }
    if (
      assignment.kind === "tier2" &&
      assignment.stableRowKeyColumn === assignment.trackingIdColumn
    ) {
      throw new OnboardingWorkflowError(
        "Tier 2 stable row key and tracking ID must use different columns.",
      );
    }
    if (
      assignment.kind === "tier2" &&
      assignment.trackingIdSource === "rop3" &&
      assignment.sourceRop3Column &&
      assignment.sourceRop3Column !== assignment.trackingIdColumn
    ) {
      throw new OnboardingWorkflowError(
        "A ROP3-tracked feed must use the same ROP3 tracking column.",
      );
    }
    bySheetId.set(assignment.sheetId, assignment);
  }

  for (const sheetId of selectedIds) {
    if (!bySheetId.has(sheetId)) {
      bySheetId.set(sheetId, { sheetId, kind: "none" });
    }
  }
  return bySheetId;
}
