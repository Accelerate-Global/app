import { describe, expect, it } from "vitest";

import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";

describe("private data chat configuration", () => {
  it("stays unavailable unless the feature and every server boundary are configured", () => {
    expect(getPrivateDataChatConfiguration({}).ready).toBe(false);
    expect(
      getPrivateDataChatConfiguration({
        PRIVATE_DATA_CHAT_ENABLED: "true",
        PRIVATE_DATA_CHAT_CANARY_EMAILS: " Admin@Example.com,admin@example.com ",
        ANALYTICS_DATABASE_URL: "postgresql://localhost/postgres",
        PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY: "a".repeat(32),
        PRIVATE_QWEN_FAKE: "true",
      }).ready,
    ).toBe(true);
    expect(
      getPrivateDataChatConfiguration({
        PRIVATE_DATA_CHAT_ENABLED: "true",
        ANALYTICS_DATABASE_URL: "postgresql://localhost/postgres",
        PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY: "a".repeat(32),
        PRIVATE_QWEN_FAKE: "true",
      }).ready,
    ).toBe(false);
  });

  it("requires HTTPS and complete machine authentication for a live gateway", () => {
    const common = {
      PRIVATE_DATA_CHAT_ENABLED: "true",
      PRIVATE_DATA_CHAT_CANARY_EMAILS: "admin@example.com",
      ANALYTICS_DATABASE_URL: "postgresql://localhost/postgres",
      PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY: "a".repeat(32),
      PRIVATE_QWEN_GATEWAY_HMAC_KEY: "b".repeat(32),
      PRIVATE_QWEN_CF_ACCESS_CLIENT_ID: "client-id",
      PRIVATE_QWEN_CF_ACCESS_CLIENT_SECRET: "client-secret",
    };

    expect(
      getPrivateDataChatConfiguration({
        ...common,
        PRIVATE_QWEN_GATEWAY_URL: "http://private.example.test",
      }).ready,
    ).toBe(false);
    expect(
      getPrivateDataChatConfiguration({
        ...common,
        PRIVATE_QWEN_GATEWAY_URL: "https://private.example.test",
      }).ready,
    ).toBe(true);
  });

  it("normalizes and deduplicates exact canary email identities", () => {
    expect(
      getPrivateDataChatConfiguration({
        PRIVATE_DATA_CHAT_CANARY_EMAILS:
          " Pilot@Example.com,pilot@example.com,not-an-email ",
      }).canaryEmails,
    ).toEqual(["pilot@example.com"]);
  });
});
