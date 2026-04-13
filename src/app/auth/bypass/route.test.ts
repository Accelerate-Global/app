import { describe, expect, it } from "vitest";

import { BYPASS_COOKIE_NAME, BYPASS_OWNER_ID } from "@/lib/auth";
import { POST } from "./route";

describe("/auth/bypass", () => {
  it("sets the fixed bypass owner cookie", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ownerId: BYPASS_OWNER_ID,
      mode: "bypass",
    });
    expect(response.headers.get("set-cookie")).toContain(BYPASS_COOKIE_NAME);
    expect(response.headers.get("set-cookie")).toContain(BYPASS_OWNER_ID);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
