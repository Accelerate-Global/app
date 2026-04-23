// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listDataLakeSources } from "@/lib/data-lake";
import DataLakePage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/data-lake", () => ({
  listDataLakeSources: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listDataLakeSourcesMock = vi.mocked(listDataLakeSources);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/data-lake", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listDataLakeSourcesMock.mockResolvedValue([]);
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(DataLakePage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the shared source catalog for authenticated viewers", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: null,
      isDatasetAdmin: false,
      mode: "supabase",
    });
    listDataLakeSourcesMock.mockResolvedValue([
      {
        datasetId: "dataset-1",
        displayName: "Joshua Project",
        sourceOrganizationName: "Joshua Project",
        datasetFileName: "joshua-project-april.csv",
        lastUploadAt: "2026-04-22T18:00:00.000Z",
        status: "ready",
        rowCount: 422,
        isPublic: true,
      },
      {
        datasetId: "dataset-2",
        displayName: "imb-april.csv",
        sourceOrganizationName: null,
        datasetFileName: "imb-april.csv",
        lastUploadAt: "2026-04-21T18:00:00.000Z",
        status: "processing",
        rowCount: 0,
        isPublic: true,
      },
    ]);

    render(await DataLakePage());

    expect(screen.getByRole("heading", { name: "Data Partners" })).toBeTruthy();
    expect(screen.getByText("Shared source catalog")).toBeTruthy();
    expect(screen.getByText("Admin naming stays restricted")).toBeTruthy();
    expect(screen.getByText("Joshua Project")).toBeTruthy();
    expect(screen.getAllByText("imb-april.csv").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Rename organization for/i }),
    ).toBeNull();
    expect(listDataLakeSourcesMock).toHaveBeenCalledWith({
      includeDisabled: false,
    });
  });

  it("renders admin naming controls for dataset admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listDataLakeSourcesMock.mockResolvedValue([
      {
        datasetId: "dataset-1",
        displayName: "joshua-project-april.csv",
        sourceOrganizationName: null,
        datasetFileName: "joshua-project-april.csv",
        lastUploadAt: "2026-04-22T18:00:00.000Z",
        status: "ready",
        rowCount: 422,
        isPublic: false,
      },
    ]);

    render(await DataLakePage());

    expect(screen.getByText("Admin organization naming enabled")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Rename organization for joshua-project-april.csv",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Upload dataset" })).toBeTruthy();
    expect(listDataLakeSourcesMock).toHaveBeenCalledWith({
      includeDisabled: true,
    });
  });
});
