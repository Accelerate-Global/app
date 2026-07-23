// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { listApiConnections } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceCatalog } from "@/lib/reference-resources";
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

vi.mock("@/lib/reference-resources", () => ({
  listReferenceResourceCatalog: vi.fn(),
}));

vi.mock("@/components/dashboard/api-connections-client", () => ({
  ApiConnectionsClient: ({
    initialConnections,
    referenceResources,
  }: {
    initialConnections: Array<{ name: string }>;
    referenceResources: Array<{ id: string; label: string }>;
  }) => (
    <div data-testid="api-connections-client">
      {initialConnections.map((connection) => (
        <span key={connection.name}>{connection.name}</span>
      ))}
      {referenceResources.map((resource) => (
        <span key={resource.id}>{resource.label}</span>
      ))}
    </div>
  ),
}));


const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listApiConnectionsMock = vi.mocked(listApiConnections);
const listReferenceResourceCatalogMock = vi.mocked(listReferenceResourceCatalog);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/api-connections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listReferenceResourceCatalogMock.mockResolvedValue([]);
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
          id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
          name: "IMB (People Groups)",
          description: "IMB public ArcGIS people groups layer.",
          method: "GET",
          url: "https://services1.arcgis.com/mICk7VdFTP86wcbI/arcgis/rest/services/pIMBpeoplePublic/FeatureServer/0/query",
          headers: [],
          bodyTemplate: "",
          responseFormat: "json",
          responseDataPath: "features",
          importMode: "create",
          targetDatasetId: null,
          datasetName: "imb-people-groups.csv",
          datasetClassification: "PGIC",
          createdAt: "2026-04-30T00:00:00.000Z",
          updatedAt: "2026-04-30T00:00:00.000Z",
        },
        {
          id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a02",
          name: "Etnopedia",
          description: "Etnopedia MediaWiki people-group export.",
          method: "GET",
          url: "https://en.etnopedia.org/api.php",
          headers: [],
          bodyTemplate: "",
          responseFormat: "json",
          responseDataPath: "",
          importMode: "create",
          targetDatasetId: null,
          datasetName: "etnopedia-people.csv",
          datasetClassification: "PGIC",
          createdAt: "2026-04-30T00:00:00.000Z",
          updatedAt: "2026-04-30T00:00:00.000Z",
        },
      ],
      runs: [],
      resources: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          connectionId: "6f9f6ef2-1188-4f71-9c24-ef01debf7a03",
          runId: "22222222-2222-4222-8222-222222222222",
          resourceUrl: "https://example.com/resource",
          normalizedUrl: "https://example.com/resource",
          webText: "Watch",
          sourceRowIndex: 0,
          sourceResourceIndex: 1,
          createdAt: "2026-04-30T00:05:00.000Z",
        },
      ],
    });
    listReferenceResourceCatalogMock.mockResolvedValue([
      {
        id: "catalog-1",
        resourceKey: "country-territory-codes",
        resourceKind: "country-geography",
        label: "Country & territory code resource",
        description: "Shared codes",
        routePath: "/dashboard/country-codes",
        sortOrder: 10,
        activeVersion: { id: "active-1" } as never,
        impact: { affectedEngines: ["Country normalization"], olderOutputCount: 0 },
      },
    ]);
    render(await ApiConnectionsPage());

    expect(document.querySelector(".max-w-7xl")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Connections" })).toBeTruthy();
    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
    expect(screen.getByText("Etnopedia")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(screen.queryByText("https://example.com/resource")).toBeNull();
    expect(screen.getByTestId("api-connections-client")).toBeTruthy();
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
