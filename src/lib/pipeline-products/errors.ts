export class PipelineProductError extends Error {
  constructor(
    message: string,
    readonly status: number = 409,
    readonly code = "pipeline-product-error",
  ) {
    super(message);
    this.name = "PipelineProductError";
  }
}
