// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { listApiConnections } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import ApiConnectionsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  listApiConnections: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listApiConnectionsMock = vi.mocked(listApiConnections);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/api-connections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ runs: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(ApiConnectionsPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin users back to the dashboard", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "basic-1",
      email: "basic@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(ApiConnectionsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders API connections for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listApiConnectionsMock.mockResolvedValue({
      connections: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "People API",
          description: "",
          method: "GET",
          url: "https://api.example.com/people",
          headers: [],
          bodyTemplate: "",
          responseFormat: "json",
          responseDataPath: "data",
          importMode: "create",
          targetDatasetId: null,
          datasetName: "people.csv",
          datasetClassification: "PGAC",
          createdAt: "2026-04-24T12:00:00.000Z",
          updatedAt: "2026-04-24T12:00:00.000Z",
        },
      ],
      runs: [],
    });
    render(await ApiConnectionsPage());

    expect(
      screen.getByRole("heading", { name: "API Connections" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /People API/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test" }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
