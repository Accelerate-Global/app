function serializeUnknownError(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => serializeUnknownError(entry, seen));
  }

  if (value instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };

    if (value.stack) {
      serialized.stack = value.stack;
    }

    const cause = (value as Error & { cause?: unknown }).cause;

    if (cause !== undefined) {
      serialized.cause = serializeUnknownError(cause, seen);
    }

    for (const [key, entry] of Object.entries(
      value as unknown as Record<string, unknown>,
    )) {
      if (["name", "message", "stack", "cause"].includes(key)) {
        continue;
      }

      serialized[key] = serializeUnknownError(entry, seen);
    }

    return serialized;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      serializeUnknownError(entry, seen),
    ]),
  );
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatUnknownError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  const serialized = serializeUnknownError(error);

  if (error instanceof Error && serialized && typeof serialized === "object") {
    const errorRecord = { ...serialized } as Record<string, unknown>;
    const stack =
      typeof errorRecord.stack === "string"
        ? errorRecord.stack
        : `${error.name}: ${error.message}`;

    delete errorRecord.stack;

    if (
      Object.keys(errorRecord).every((key) => ["name", "message"].includes(key))
    ) {
      return stack;
    }

    return `${stack}\nDetails: ${safeStringify(errorRecord)}`;
  }

  if (
    serialized &&
    typeof serialized === "object" &&
    !Array.isArray(serialized)
  ) {
    return safeStringify(serialized);
  }

  return String(serialized);
}
