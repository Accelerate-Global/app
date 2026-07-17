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
    };
    const next = datasetOnboardingReducer(state, {
      type: "set-spreadsheet-url",
      value: "https://docs.google.com/two",
    });
    expect(next.preview).toBeNull();
    expect(next.selectedSheetIds).toEqual([]);
    expect(next.datasetNames).toEqual({});
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

    const locked = datasetOnboardingReducer(state, { type: "lock-import" });
    expect(
      datasetOnboardingReducer(locked, { type: "set-stage", stage: "details" }),
    ).toBe(locked);
  });
});
