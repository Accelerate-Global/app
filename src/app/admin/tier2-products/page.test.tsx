// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getTier2AdminOverview } from "@/lib/tier2-products";

import Tier2ProductsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => { throw new Error(`NEXT_REDIRECT:${target}`); }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/tier2-products", () => ({ getTier2AdminOverview: vi.fn() }));
vi.mock("@/components/tier2-products/tier2-products-admin", () => ({
  Tier2ProductsAdmin: () => <div>Tier 2 admin client</div>,
}));
vi.mock("@/components/layout/site-header", () => ({ SiteHeader: () => <header>Header</header> }));

const admin = {
  ownerId: "admin",
  email: "admin@example.test",
  fullName: null,
  workspaceRole: "admin",
  isDatasetAdmin: true,
  mode: "supabase",
} as const;

describe("/admin/tier2-products", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects anonymous and non-admin users", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    await expect(Tier2ProductsPage()).rejects.toThrow("NEXT_REDIRECT:/");
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ...admin,
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });
    await expect(Tier2ProductsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the protected Tier 2 surface and smoke marker", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    vi.mocked(getTier2AdminOverview).mockResolvedValue({} as never);
    render(await Tier2ProductsPage());
    expect(screen.getByRole("heading", { name: "Tier 2 Products" })).toBeTruthy();
    expect(document.querySelector('[data-smoke-page="tier2-products"]')).toBeTruthy();
  });
});
