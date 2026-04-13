import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: () => false,
}));

describe("/auth/sign-out", () => {
  it("returns ok when Supabase config is disabled", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
