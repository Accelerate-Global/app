export class PipelineOperationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "pipeline-operation-invalid",
  ) {
    super(message);
    this.name = "PipelineOperationError";
  }
}

export function isPipelineOperationError(
  error: unknown,
): error is PipelineOperationError {
  return error instanceof PipelineOperationError;
}
