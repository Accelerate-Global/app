import { afterEach, describe, expect, it } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { getSiteNavLinks } from "@/lib/site-navigation";

const originalEnvironment = { ...process.env };
const identity = (isDatasetAdmin: boolean): CurrentIdentity => ({
  ownerId: "owner-1",
  email: "user@example.com",
  fullName: null,
  workspaceRole: isDatasetAdmin ? "admin" : "pro",
  isDatasetAdmin,
  mode: "supabase",
});

describe("site navigation", () => {
  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("shows private data chat only to configured pilot administrators", () => {
    process.env.PRIVATE_DATA_CHAT_ENABLED = "true";
    process.env.PRIVATE_DATA_CHAT_CANARY_EMAILS = "user@example.com";
    process.env.ANALYTICS_DATABASE_URL = "postgresql://example.test/postgres";
    process.env.PRIVATE_DATA_CHAT_AUDIT_HMAC_KEY = "a".repeat(32);
    process.env.PRIVATE_QWEN_FAKE = "true";

    expect(getSiteNavLinks(identity(true))).toContainEqual({
      href: "/dashboard/chat",
      label: "Data Chat",
    });
    expect(getSiteNavLinks(identity(false))).toEqual([]);

    process.env.PRIVATE_DATA_CHAT_CANARY_EMAILS = "other@example.com";
    expect(getSiteNavLinks(identity(true))).toEqual([]);
  });
});
