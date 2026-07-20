import { describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import FieldSourcesPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

describe("/dashboard/field-sources", () => {
  it("redirects the retired route to Definitions", () => {
    expect(() => FieldSourcesPage()).toThrow(
      "NEXT_REDIRECT:/dashboard/field-definitions",
    );
    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      "/dashboard/field-definitions",
    );
  });
});
