export type DatasetFormingErrorCode =
  | "unsupported-source-profile"
  | "ambiguous-source-profile"
  | "invalid-engine-declaration"
  | "duplicate-engine-key"
  | "ineligible-source-snapshot"
  | "missing-source-checksum"
  | "candidate-not-publishable"
  | "candidate-not-rejectable"
  | "invalid-decision"
  | "invalid-resource-bindings";

export class DatasetFormingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code: DatasetFormingErrorCode = "invalid-engine-declaration",
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DatasetFormingError";
  }
}
