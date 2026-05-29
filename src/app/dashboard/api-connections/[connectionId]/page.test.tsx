// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notFound, redirect } from "next/navigation";

import {
  getApiConnection,
  listApiConnectionRuns,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import ApiConnectionDetailPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/api-connections", () => ({
  getApiConnection: vi.fn(),
  listApiConnectionRuns: vi.fn(),
}));

vi.mock("@/components/dashboard/api-connection-detail-client", () => ({
  ApiConnectionDetailClient: ({
    connection,
    initialRuns,
  }: {
    connection: { name: string };
    initialRuns: unknown[];
  }) => (
    <div data-testid="api-connection-detail-client">
      {connection.name}:{initialRuns.length}
    </div>
  ),
}));


const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getApiConnectionMock = vi.mocked(getApiConnection);
const listApiConnectionRunsMock = vi.mocked(listApiConnectionRuns);
const redirectMock = vi.mocked(redirect);
const notFoundMock = vi.mocked(notFound);

const connection = {
  id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
  name: "IMB (People Groups)",
  description: "IMB public ArcGIS people groups layer.",
  method: "GET" as const,
  url: "https://example.com/api",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json" as const,
  responseDataPath: "features",
  importMode: "create" as const,
  targetDatasetId: null,
  datasetName: "imb-people-groups.csv",
  datasetClassification: "PGIC" as const,
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
};

const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "import" as const,
  status: "success" as const,
  httpStatus: 200,
  durationMs: 120,
  rowCount: 4,
  datasetId: null,
  errorMessage: null,
  responsePreview: "[]",
  startedAt: "2026-04-30T12:00:00.000Z",
  completedAt: "2026-04-30T12:00:01.000Z",
  createdAt: "2026-04-30T12:00:00.000Z",
  logs: [],
  output: null,
};

function renderPage(connectionId = connection.id) {
  return ApiConnectionDetailPage({
    params: Promise.resolve({ connectionId }),
  });
}

describe("/dashboard/api-connections/[connectionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT:/");
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

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns not-found for unknown connections", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    getApiConnectionMock.mockResolvedValue(null);

    await expect(renderPage("unknown-connection")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders the known built-in connection for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    getApiConnectionMock.mockResolvedValue(connection);
    listApiConnectionRunsMock.mockResolvedValue([run]);

    const { container } = render(await renderPage());

    expect(
      container.querySelector('[data-smoke-page="api-connection-detail"]'),
    ).toBeTruthy();
    expect(container.querySelector(".max-w-7xl")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to Datasets/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "IMB (People Groups)" })).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
    expect(screen.getByTestId("api-connection-detail-client").textContent).toBe(
      "IMB (People Groups):1",
    );
    expect(getApiConnectionMock).toHaveBeenCalledWith(connection.id);
    expect(listApiConnectionRunsMock).toHaveBeenCalledWith(connection.id);
  });
});
