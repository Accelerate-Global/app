import { describe, expect, it } from "vitest";

import type { CurrentIdentity } from "@/lib/auth";
import { getSiteNavLinks } from "@/lib/site-navigation";

const identity = (isDatasetAdmin: boolean): CurrentIdentity => ({
  ownerId: "owner-1",
  email: "user@example.com",
  fullName: null,
  workspaceRole: isDatasetAdmin ? "admin" : "pro",
  isDatasetAdmin,
  mode: "supabase",
});

describe("site navigation", () => {
  it("does not add retired feature links for signed-in users", () => {
    expect(getSiteNavLinks(identity(true))).toEqual([]);
    expect(getSiteNavLinks(identity(false))).toEqual([]);
  });
});
