// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  createInitialDatasetOnboardingState,
  datasetOnboardingReducer,
  initialDatasetOnboardingState,
} from "./dataset-onboarding-reducer";

describe("datasetOnboardingReducer", () => {
  it("starts from a deep-linked source and resets source-specific state", () => {
    const deepLinked = createInitialDatasetOnboardingState("csv");
    expect(deepLinked).toMatchObject({ source: "csv", stage: "connect" });

    const switched = datasetOnboardingReducer(
      { ...deepLinked, csvDatasetName: "Example" },
      { type: "select-source", source: "google-sheets" },
    );
    expect(switched).toMatchObject({
      source: "google-sheets",
      stage: "connect",
      csvDatasetName: "",
    });
  });

  it("clears Sheet-dependent state when the URL changes", () => {
    const state = {
      ...initialDatasetOnboardingState,
      source: "google-sheets" as const,
      preview: {
        spreadsheetId: "one",
        spreadsheetUrl: "https://docs.google.com/one",
        spreadsheetTitle: "One",
        sheets: [],
      },
      selectedSheetIds: [1],
      datasetNames: { 1: "People" },
      workflowAssignments: { 1: { sheetId: 1, kind: "none" as const } },
    };
    const next = datasetOnboardingReducer(state, {
      type: "set-spreadsheet-url",
      value: "https://docs.google.com/two",
    });
    expect(next.preview).toBeNull();
    expect(next.selectedSheetIds).toEqual([]);
    expect(next.datasetNames).toEqual({});
    expect(next.workflowAssignments).toEqual({});
  });

  it("ignores stale access responses", () => {
    const started = datasetOnboardingReducer(initialDatasetOnboardingState, {
      type: "access-started",
      requestKey: 4,
    });
    const stale = datasetOnboardingReducer(started, {
      type: "access-succeeded",
      requestKey: 3,
      preview: {
        spreadsheetId: "stale",
        spreadsheetUrl: "https://docs.google.com/stale",
        spreadsheetTitle: "Stale",
        sheets: [],
      },
    });
    expect(stale.preview).toBeNull();
  });

  it("clears only the deselected tab and locks backward navigation during import", () => {
    let state = datasetOnboardingReducer(initialDatasetOnboardingState, {
      type: "toggle-sheet",
      sheetId: 1,
      defaultName: "One",
    });
    state = datasetOnboardingReducer(state, {
      type: "toggle-sheet",
      sheetId: 2,
      defaultName: "Two",
    });
    state = datasetOnboardingReducer(state, {
      type: "toggle-sheet",
      sheetId: 1,
      defaultName: "One",
    });
    expect(state.selectedSheetIds).toEqual([2]);
    expect(state.datasetNames).toEqual({ 2: "Two" });
    expect(state.workflowAssignments).toEqual({ 2: { sheetId: 2, kind: "none" } });

    const locked = datasetOnboardingReducer(state, { type: "lock-import" });
    expect(
      datasetOnboardingReducer(locked, { type: "set-stage", stage: "details" }),
    ).toBe(locked);
  });

  it("stores one reviewed workflow assignment per selected Sheet tab", () => {
    let state = datasetOnboardingReducer(initialDatasetOnboardingState, {
      type: "toggle-sheet",
      sheetId: 42,
      defaultName: "Final-58",
    });
    state = datasetOnboardingReducer(state, {
      type: "set-workflow-assignment",
      sheetId: 42,
      assignment: {
        sheetId: 42,
        kind: "tier2",
        ownerKey: "ax",
        feedKey: "final-58",
        feedName: "Final-58",
        stableRowKeyColumn: "Row ID",
        trackingIdColumn: "PeopleID3",
        trackingIdSource: "peopleid3",
        sourceRop3Column: null,
        sourceCountryColumn: null,
        sourceIso3Column: null,
      },
    });
    expect(state.workflowAssignments[42]?.kind).toBe("tier2");
  });
});
