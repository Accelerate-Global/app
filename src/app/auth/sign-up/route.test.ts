import { beforeEach, describe, expect, it, vi } from "vitest";

import { isEmailAllowedForSignup } from "@/lib/signup-allowlist";
import { POST } from "./route";

vi.mock("@/lib/signup-allowlist", () => ({
  isEmailAllowedForSignup: vi.fn(),
}));

const isEmailAllowedForSignupMock = vi.mocked(isEmailAllowedForSignup);

describe("/auth/sign-up", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects requests without a valid email", async () => {
    const response = await POST(
      new Request("http://localhost/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "A valid email address is required.",
    });
  });

  it("rejects emails that are not on the allowlist", async () => {
    isEmailAllowedForSignupMock.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: "blocked@example.com" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message:
        "This email address has not been granted access yet. Ask an administrator to add it to the signup allowlist first.",
    });
  });

  it("allows emails that are on the allowlist", async () => {
    isEmailAllowedForSignupMock.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ email: "allowed@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
