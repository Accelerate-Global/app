import { describe, expect, it, vi } from "vitest";

import { BYPASS_COOKIE_NAME } from "@/lib/auth";
import { POST } from "./route";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: () => false,
}));

describe("/auth/sign-out", () => {
  it("clears the bypass cookie", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain(BYPASS_COOKIE_NAME);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
