import type {
  CsvColumn,
  DatasetClassification,
  GoogleSheetsConnectionPreview,
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";

export type OnboardingSource = "google-sheets" | "csv";
export type OnboardingStage =
  | "source"
  | "connect"
  | "structure"
  | "details"
  | "review"
  | "import"
  | "complete";

export type DatasetOnboardingState = {
  stage: OnboardingStage;
  source: OnboardingSource | null;
  spreadsheetUrl: string;
  accessRequestKey: number;
  preview: GoogleSheetsConnectionPreview | null;
  selectedSheetIds: number[];
  headerPreviews: Record<number, GoogleSheetsHeaderPreview>;
  headerSelections: Record<number, GoogleSheetsHeaderSelectionInput>;
  datasetNames: Record<number, string>;
  csvFile: File | null;
  csvColumns: CsvColumn[];
  csvDatasetName: string;
  classification: DatasetClassification;
  isWorkspaceVisible: boolean;
  importLocked: boolean;
};

export type DatasetOnboardingAction =
  | { type: "select-source"; source: OnboardingSource }
  | { type: "set-stage"; stage: OnboardingStage }
  | { type: "set-spreadsheet-url"; value: string }
  | { type: "access-started"; requestKey: number }
  | {
      type: "access-succeeded";
      requestKey: number;
      preview: GoogleSheetsConnectionPreview;
    }
  | { type: "toggle-sheet"; sheetId: number; defaultName: string }
  | {
      type: "header-loaded";
      sheetId: number;
      preview: GoogleSheetsHeaderPreview;
      selection: GoogleSheetsHeaderSelectionInput;
    }
  | { type: "set-dataset-name"; sheetId: number; value: string }
  | {
      type: "set-csv";
      file: File;
      columns: CsvColumn[];
      datasetName: string;
    }
  | { type: "set-csv-name"; value: string }
  | { type: "set-classification"; value: DatasetClassification }
  | { type: "set-visibility"; value: boolean }
  | { type: "lock-import" }
  | { type: "complete" };

export const initialDatasetOnboardingState: DatasetOnboardingState = {
  stage: "source",
  source: null,
  spreadsheetUrl: "",
  accessRequestKey: 0,
  preview: null,
  selectedSheetIds: [],
  headerPreviews: {},
  headerSelections: {},
  datasetNames: {},
  csvFile: null,
  csvColumns: [],
  csvDatasetName: "",
  classification: "PGAC",
  isWorkspaceVisible: true,
  importLocked: false,
};

export function createInitialDatasetOnboardingState(
  source?: OnboardingSource | null,
): DatasetOnboardingState {
  return source
    ? { ...initialDatasetOnboardingState, source, stage: "connect" }
    : initialDatasetOnboardingState;
}

export function datasetOnboardingReducer(
  state: DatasetOnboardingState,
  action: DatasetOnboardingAction,
): DatasetOnboardingState {
  switch (action.type) {
    case "select-source":
      return {
        ...initialDatasetOnboardingState,
        source: action.source,
        stage: "connect",
        classification: state.classification,
        isWorkspaceVisible: state.isWorkspaceVisible,
      };
    case "set-stage":
      return state.importLocked && action.stage !== "import" && action.stage !== "complete"
        ? state
        : { ...state, stage: action.stage };
    case "set-spreadsheet-url":
      return {
        ...state,
        spreadsheetUrl: action.value,
        preview: null,
        selectedSheetIds: [],
        headerPreviews: {},
        headerSelections: {},
        datasetNames: {},
      };
    case "access-started":
      return { ...state, accessRequestKey: action.requestKey };
    case "access-succeeded":
      return action.requestKey === state.accessRequestKey
        ? { ...state, preview: action.preview, stage: "structure" }
        : state;
    case "toggle-sheet": {
      if (state.selectedSheetIds.includes(action.sheetId)) {
        const nextPreviews = { ...state.headerPreviews };
        const nextSelections = { ...state.headerSelections };
        const nextNames = { ...state.datasetNames };
        delete nextPreviews[action.sheetId];
        delete nextSelections[action.sheetId];
        delete nextNames[action.sheetId];
        return {
          ...state,
          selectedSheetIds: state.selectedSheetIds.filter(
            (sheetId) => sheetId !== action.sheetId,
          ),
          headerPreviews: nextPreviews,
          headerSelections: nextSelections,
          datasetNames: nextNames,
        };
      }

      return {
        ...state,
        selectedSheetIds: [...state.selectedSheetIds, action.sheetId],
        datasetNames: {
          ...state.datasetNames,
          [action.sheetId]: action.defaultName,
        },
      };
    }
    case "header-loaded":
      return state.selectedSheetIds.includes(action.sheetId)
        ? {
            ...state,
            headerPreviews: {
              ...state.headerPreviews,
              [action.sheetId]: action.preview,
            },
            headerSelections: {
              ...state.headerSelections,
              [action.sheetId]: action.selection,
            },
          }
        : state;
    case "set-dataset-name":
      return {
        ...state,
        datasetNames: { ...state.datasetNames, [action.sheetId]: action.value },
      };
    case "set-csv":
      return {
        ...state,
        csvFile: action.file,
        csvColumns: action.columns,
        csvDatasetName: action.datasetName,
        stage: "structure",
      };
    case "set-csv-name":
      return { ...state, csvDatasetName: action.value };
    case "set-classification":
      return { ...state, classification: action.value };
    case "set-visibility":
      return { ...state, isWorkspaceVisible: action.value };
    case "lock-import":
      return { ...state, stage: "import", importLocked: true };
    case "complete":
      return { ...state, stage: "complete", importLocked: true };
  }
}
