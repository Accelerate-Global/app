// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceCatalog } from "@/lib/reference-resources";
import ResourcesPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/reference-resources", () => ({
  listReferenceResourceCatalog: vi.fn(),
}));


const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listReferenceResourceCatalogMock = vi.mocked(listReferenceResourceCatalog);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/resources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const version = {
      id: "10000000-0000-4000-8000-000000000001",
      resourceKey: "country-territory-codes" as const,
      versionNumber: 1,
      lifecycleState: "valid" as const,
      schemaVersion: 1,
      contentChecksum: "a".repeat(64),
      sourceRetrievedAt: "2026-07-17T00:00:00.000Z",
      entryCount: 273,
      validationSummary: {},
      diffSummary: {},
      createdByOwnerId: "admin-1",
      createdAt: "2026-07-17T00:00:00.000Z",
      finalizedAt: "2026-07-17T00:00:00.000Z",
      rejectionReason: null,
      isActive: true,
    };
    listReferenceResourceCatalogMock.mockResolvedValue([
      {
        id: "20000000-0000-4000-8000-000000000001",
        resourceKey: "country-territory-codes",
        resourceKind: "country-geography",
        label: "Country & territory code resource",
        description: "Search and download shared ISO, GENC, FIPS, and ROG3 country and territory codes.",
        routePath: "/dashboard/country-codes",
        sortOrder: 10,
        activeVersion: version,
        impact: { affectedEngines: ["Country normalization"], olderOutputCount: 0 },
        attentionState: "valid-candidate",
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        resourceKey: "rop-codes",
        resourceKind: "rop-taxonomy",
        label: "ROP Codes resource",
        description: "Search and download matched HIS ROP1, ROP2, ROP25, and ROP3 codes.",
        routePath: "/dashboard/rop-codes",
        sortOrder: 20,
        activeVersion: { ...version, id: "10000000-0000-4000-8000-000000000002", resourceKey: "rop-codes" },
        impact: { affectedEngines: ["ROP normalization"], olderOutputCount: 2 },
        attentionState: "invalid-build",
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        resourceKey: "source-aliases",
        resourceKind: "source-registry",
        label: "Dataset source aliases",
        description: "Canonical source keys and accepted dataset source names.",
        routePath: "/dashboard/resources",
        sortOrder: 30,
        activeVersion: {
          ...version,
          id: "10000000-0000-4000-8000-000000000003",
          resourceKey: "source-aliases",
        },
        impact: { affectedEngines: ["Tier 1 source forming"], olderOutputCount: 0 },
        attentionState: null,
      },
    ]);
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(ResourcesPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders built-in resources for authenticated non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(await ResourcesPage());

    expect(document.querySelector(".max-w-7xl")).toBeTruthy();
    expect(document.querySelector(".sm\\:grid-cols-2")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(
      screen.getByText(
        "Search and download shared ISO, GENC, FIPS, and ROG3 country and territory codes.",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Country & territory code resource/ })
        .getAttribute("href"),
    ).toBe("/dashboard/country-codes");
    expect(screen.getByText("ROP Codes resource")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /ROP Codes resource/ }).getAttribute("href"),
    ).toBe("/dashboard/rop-codes");
    expect(
      screen.getByRole("link", { name: /Dataset source aliases/ }).getAttribute("href"),
    ).toBe("/dashboard/resources/source-aliases");
    expect(screen.getAllByText(/Updated/u)).toHaveLength(3);
    expect(screen.queryByText(/Active v/u)).toBeNull();
    expect(screen.queryByText(/Retrieved/u)).toBeNull();
    expect(screen.queryByText("Open resource")).toBeNull();
    expect(document.querySelector('[data-smoke-page="resources"]')).toBeTruthy();
  });

  it("does not show inactive candidate labels on usable resource cards", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    render(await ResourcesPage());

    expect(listReferenceResourceCatalogMock).toHaveBeenCalledWith();
    expect(screen.queryByText("valid candidate")).toBeNull();
    expect(screen.queryByText("invalid build")).toBeNull();
  });
});
