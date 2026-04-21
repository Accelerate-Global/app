type SafeErrorLogRecord = {
  name: string;
  message: string;
  status?: number;
  code?: string | number;
};

function getOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function getOptionalCode(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export function normalizeErrorForLogging(error: unknown): SafeErrorLogRecord {
  if (error instanceof Error) {
    const details = error as Error & { status?: unknown; code?: unknown };

    return {
      name: details.name || "Error",
      message: details.message || "Unknown error",
      status: getOptionalNumber(details.status),
      code: getOptionalCode(details.code),
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  if (typeof error === "object" && error !== null) {
    const details = error as {
      name?: unknown;
      message?: unknown;
      status?: unknown;
      code?: unknown;
    };

    return {
      name: typeof details.name === "string" && details.name ? details.name : "Error",
      message:
        typeof details.message === "string" && details.message
          ? details.message
          : "Unknown error",
      status: getOptionalNumber(details.status),
      code: getOptionalCode(details.code),
    };
  }

  return {
    name: "Error",
    message: error === undefined ? "Unknown error" : String(error),
  };
}

export function logError(
  context: string,
  error: unknown,
  logger: typeof console.error = console.error,
) {
  logger(context, normalizeErrorForLogging(error));
}
