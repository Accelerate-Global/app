export class Tier2ProductError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "Tier2ProductError";
  }
}
