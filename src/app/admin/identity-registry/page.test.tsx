// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getAxIdentityRegistryOverview } from "@/lib/identity-registry";
import IdentityRegistryPage from "./page";

const { identityClientSpy } = vi.hoisted(() => ({
  identityClientSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => { throw new Error(`NEXT_REDIRECT:${target}`); }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/identity-registry", () => ({ getAxIdentityRegistryOverview: vi.fn() }));
vi.mock("@/components/identity-registry/identity-registry-client", () => ({
  IdentityRegistryClient: (props: unknown) => {
    identityClientSpy(props);
    return <div>Registry client</div>;
  },
}));
vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

const admin = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/admin/identity-registry", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects anonymous and non-admin users", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    await expect(IdentityRegistryPage()).rejects.toThrow("NEXT_REDIRECT:/");
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ...admin, workspaceRole: "basic", isDatasetAdmin: false });
    await expect(IdentityRegistryPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders the admin registry page and smoke marker", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    vi.mocked(getAxIdentityRegistryOverview).mockResolvedValue({ bindings: [], revisions: [], runs: [] });
    render(await IdentityRegistryPage());
    expect(screen.getByRole("heading", { name: "AX Identity Registry" })).toBeTruthy();
    expect(document.querySelector('[data-smoke-page="identity-registry"]')).toBeTruthy();
  });

  it("passes an exact linked run into the registry client", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    vi.mocked(getAxIdentityRegistryOverview).mockResolvedValue({
      bindings: [],
      revisions: [],
      runs: [],
    });
    render(
      await IdentityRegistryPage({
        searchParams: Promise.resolve({ runId: "identity-run-1" }),
      }),
    );
    expect(identityClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelectedRunId: "identity-run-1",
      }),
    );
  });
});
