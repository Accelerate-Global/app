import { describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import AnalyticsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

describe("/dashboard/analytics", () => {
  it("redirects the retired route to User Management", () => {
    expect(() => AnalyticsPage()).toThrow(
      "NEXT_REDIRECT:/dashboard/user-management",
    );
    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      "/dashboard/user-management",
    );
  });
});
