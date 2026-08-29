import { describe, expect, it } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import {
  canUsePrivateDataChat,
  isPrivateDataChatPilotIdentity,
} from "@/lib/private-data-chat/access";
import type { PrivateDataChatConfiguration } from "@/lib/private-data-chat/config";

const identity = (isDatasetAdmin: boolean): CurrentIdentity => ({
  ownerId: "owner-1",
  email: "user@example.com",
  fullName: null,
  workspaceRole: isDatasetAdmin ? "admin" : "pro",
  isDatasetAdmin,
  mode: "supabase",
});

const configuration = (
  ready: boolean,
  canaryEmails = ["user@example.com"],
): PrivateDataChatConfiguration => ({
  enabled: ready,
  canaryEmails,
  analyticsDatabaseUrl: ready ? "postgresql://example.test/postgres" : null,
  auditHmacKey: ready ? "a".repeat(32) : null,
  qwenGatewayUrl: null,
  qwenGatewayHmacKey: null,
  cloudflareAccessClientId: null,
  cloudflareAccessClientSecret: null,
  useFakeQwen: ready,
  ready,
});

describe("private data chat access", () => {
  it("limits the pilot to exact allowlisted admin-capable identities", () => {
    expect(
      isPrivateDataChatPilotIdentity(identity(true), configuration(true)),
    ).toBe(true);
    expect(
      isPrivateDataChatPilotIdentity(identity(false), configuration(true)),
    ).toBe(false);
    expect(isPrivateDataChatPilotIdentity(null, configuration(true))).toBe(false);
    expect(
      isPrivateDataChatPilotIdentity(
        identity(true),
        configuration(true, ["other@example.com"]),
      ),
    ).toBe(false);
  });

  it("requires both pilot permission and complete configuration", () => {
    expect(canUsePrivateDataChat(identity(true), configuration(true))).toBe(true);
    expect(canUsePrivateDataChat(identity(false), configuration(true))).toBe(false);
    expect(canUsePrivateDataChat(identity(true), configuration(false))).toBe(false);
    expect(
      canUsePrivateDataChat(
        identity(true),
        configuration(true, ["other@example.com"]),
      ),
    ).toBe(false);
  });
});
