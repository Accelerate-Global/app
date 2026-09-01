type PrivateDataChatEnvironment = {
  [key: string]: string | undefined;
};

export type PrivateDataChatConfiguration = {
  enabled: boolean;
  semanticContextEnabled: boolean;
  canaryEmails: string[];
  analyticsDatabaseUrl: string | null;
  auditHmacKey: string | null;
  turnStateHmacKey: string | null;
  viewContextHmacKey: string | null;
  continuationHmacKey: string | null;
  qwenGatewayUrl: string | null;
  qwenGatewayHmacKey: string | null;
  cloudflareAccessClientId: string | null;
  cloudflareAccessClientSecret: string | null;
  useFakeQwen: boolean;
  ready: boolean;
};

function value(environment: PrivateDataChatEnvironment, key: keyof PrivateDataChatEnvironment) {
  return environment[key]?.trim() || null;
}

function isHttpsUrl(input: string | null) {
  if (!input) {
    return false;
  }

  try {
    return new URL(input).protocol === "https:";
  } catch {
    return false;
  }
}

function canaryEmails(environment: PrivateDataChatEnvironment) {
  return [
    ...new Set(
      (environment.PRIVATE_DATA_CHAT_CANARY_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)),
    ),
  ];
}

export function getPrivateDataChatConfiguration(
  environment: PrivateDataChatEnvironment = process.env,
): PrivateDataChatConfiguration {
  const enabled = value(environment, "PRIVATE_DATA_CHAT_ENABLED") === "true";
  const semanticContextEnabled =
    value(environment, "PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED") === "true";
  const pilotEmails = canaryEmails(environment);
  const useFakeQwen = value(environment, "PRIVATE_QWEN_FAKE") === "true";
  const analyticsDatabaseUrl = value(environment, "ANALYTICS_DATABASE_URL");
  const auditHmacKey = value(environment, "PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY");
  const turnStateHmacKey = value(
    environment,
    "PRIVATE_DATA_CHAT_TURN_STATE_HMAC_KEY",
  );
  const viewContextHmacKey = value(
    environment,
    "PRIVATE_DATA_CHAT_VIEW_CONTEXT_HMAC_KEY",
  );
  const continuationHmacKey = value(
    environment,
    "PRIVATE_DATA_CHAT_CONTINUATION_HMAC_KEY",
  );
  const qwenGatewayUrl = value(environment, "PRIVATE_QWEN_GATEWAY_URL");
  const qwenGatewayHmacKey = value(environment, "PRIVATE_QWEN_GATEWAY_HMAC_KEY");
  const cloudflareAccessClientId = value(
    environment,
    "PRIVATE_QWEN_CF_ACCESS_CLIENT_ID",
  );
  const cloudflareAccessClientSecret = value(
    environment,
    "PRIVATE_QWEN_CF_ACCESS_CLIENT_SECRET",
  );
  const hasQwenConfiguration =
    useFakeQwen ||
    (isHttpsUrl(qwenGatewayUrl) &&
      (qwenGatewayHmacKey?.length ?? 0) >= 32 &&
      Boolean(cloudflareAccessClientId) &&
      Boolean(cloudflareAccessClientSecret));

  return {
    enabled,
    semanticContextEnabled,
    canaryEmails: pilotEmails,
    analyticsDatabaseUrl,
    auditHmacKey,
    turnStateHmacKey,
    viewContextHmacKey,
    continuationHmacKey,
    qwenGatewayUrl,
    qwenGatewayHmacKey,
    cloudflareAccessClientId,
    cloudflareAccessClientSecret,
    useFakeQwen,
    ready:
      enabled &&
      pilotEmails.length > 0 &&
      Boolean(analyticsDatabaseUrl) &&
      (auditHmacKey?.length ?? 0) >= 32 &&
      (!semanticContextEnabled ||
        ((turnStateHmacKey?.length ?? 0) >= 32 &&
          (viewContextHmacKey?.length ?? 0) >= 32 &&
          (continuationHmacKey?.length ?? 0) >= 32)) &&
      hasQwenConfiguration,
  };
}
