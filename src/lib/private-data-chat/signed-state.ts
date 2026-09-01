import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNED_STATE_TOKEN_VERSION = "v1";
const SIGNED_STATE_MAX_TOKEN_BYTES = 12_000;

export class PrivateDataChatSignedStateError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PrivateDataChatSignedStateError";
    this.code = code;
  }
}

function signature(input: {
  purpose: string;
  encodedPayload: string;
  key: string;
}) {
  return createHmac("sha256", input.key)
    .update(`private-data-chat:${input.purpose}:${SIGNED_STATE_TOKEN_VERSION}\n`)
    .update(input.encodedPayload)
    .digest("base64url");
}

export function privateDataChatSubjectBinding(input: {
  ownerId: string;
  key: string;
}) {
  return createHmac("sha256", input.key)
    .update("private-data-chat:subject:v1\n")
    .update(input.ownerId)
    .digest("hex");
}

export function signPrivateDataChatState(input: {
  purpose: string;
  payload: Record<string, unknown>;
  key: string;
}) {
  if (input.key.length < 32) {
    throw new PrivateDataChatSignedStateError(
      "signing_key_invalid",
      "The signed-state key is not safely configured.",
    );
  }
  const encodedPayload = Buffer.from(JSON.stringify(input.payload), "utf8").toString(
    "base64url",
  );
  const signed = signature({
    purpose: input.purpose,
    encodedPayload,
    key: input.key,
  });
  const token = `${SIGNED_STATE_TOKEN_VERSION}.${encodedPayload}.${signed}`;
  if (Buffer.byteLength(token, "utf8") > SIGNED_STATE_MAX_TOKEN_BYTES) {
    throw new PrivateDataChatSignedStateError(
      "signed_state_too_large",
      "The signed state exceeds its size policy.",
    );
  }
  return token;
}

export function verifyPrivateDataChatState(input: {
  purpose: string;
  token: string;
  key: string;
}) {
  if (
    input.key.length < 32 ||
    Buffer.byteLength(input.token, "utf8") > SIGNED_STATE_MAX_TOKEN_BYTES
  ) {
    throw new PrivateDataChatSignedStateError(
      "signed_state_invalid",
      "The signed state is invalid.",
    );
  }

  const [version, encodedPayload, suppliedSignature, ...extra] =
    input.token.split(".");
  if (
    version !== SIGNED_STATE_TOKEN_VERSION ||
    !encodedPayload ||
    !suppliedSignature ||
    extra.length > 0
  ) {
    throw new PrivateDataChatSignedStateError(
      "signed_state_invalid",
      "The signed state is invalid.",
    );
  }

  const expected = signature({
    purpose: input.purpose,
    encodedPayload,
    key: input.key,
  });
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new PrivateDataChatSignedStateError(
      "signed_state_invalid",
      "The signed state is invalid.",
    );
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new PrivateDataChatSignedStateError(
      "signed_state_invalid",
      "The signed state is invalid.",
    );
  }
}
