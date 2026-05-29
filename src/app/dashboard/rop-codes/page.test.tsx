// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedRopCodeResource } from "@/lib/rop-codes";
import type { RopCodeResource } from "@/lib/rop-codes";
import RopCodesPage from "./page";

const { ropCodesClientMock } = vi.hoisted(() => ({
  ropCodesClientMock: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/rop-codes", () => ({
  getGeneratedRopCodeResource: vi.fn(),
}));


vi.mock("@/components/dashboard/rop-codes-client", () => ({
  RopCodesClient: ropCodesClientMock,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getGeneratedRopCodeResourceMock = vi.mocked(getGeneratedRopCodeResource);
const redirectMock = vi.mocked(redirect);

const resource = {
  sourceName: "HIS Registry of Peoples",
  sourceUrl: "https://hisregistries.org/rop/",
  featureServerUrl: "https://example.test/FeatureServer",
  sourceRetrievedAt: "2026-05-07T00:00:00.000Z",
  entryCount: 0,
  rop1Count: 0,
  rop2Count: 0,
  rop25Count: 0,
  rop3Count: 0,
  geoIndexCount: 0,
  joinIssueCounts: {
    "missing-rop25": 0,
    "parent-only-rop25": 0,
    "rop2-conflict": 0,
  },
  rop1DetailsByCode: {},
  rop2DetailsByCode: {},
  rop25DetailsByCode: {},
  rop3DetailsByCode: {},
  entries: [],
  geoIndexByRop3: {},
} satisfies RopCodeResource;

describe("/dashboard/rop-codes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGeneratedRopCodeResourceMock.mockReturnValue(resource);
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(RopCodesPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the generated ROP code resource for authenticated users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(await RopCodesPage());

    expect(screen.getByText("ROP Codes")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to resources" }).getAttribute("href"),
    ).toBe("/dashboard/resources");
    expect(ropCodesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResource: resource,
        canRefresh: false,
      }),
      undefined,
    );
  });

  it("passes admin refresh capability", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    render(await RopCodesPage());

    expect(ropCodesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResource: resource,
        canRefresh: true,
      }),
      undefined,
    );
  });
});
