// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  getReferenceResourcePage,
  listReferenceResourceCatalog,
} from "@/lib/reference-resources";
import PipelineReferenceResourcePage from "./page";

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

vi.mock("@/lib/reference-resources", () => ({
  getReferenceResourcePage: vi.fn(),
  listReferenceResourceCatalog: vi.fn(),
}));

vi.mock("@/components/dashboard/pipeline-reference-resource-client", () => ({
  PipelineReferenceResourceClient: ({
    resourceKey,
    canManageLifecycle,
  }: {
    resourceKey: string;
    canManageLifecycle: boolean;
  }) => (
    <div
      data-testid="pipeline-resource-client"
      data-resource-key={resourceKey}
      data-can-manage={String(canManageLifecycle)}
    />
  ),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getReferenceResourcePageMock = vi.mocked(getReferenceResourcePage);
const listReferenceResourceCatalogMock = vi.mocked(
  listReferenceResourceCatalog,
);

const version = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "source-aliases" as const,
  versionNumber: 1,
  lifecycleState: "valid" as const,
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: "2026-03-30T20:41:00.000Z",
  entryCount: 10,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: "2026-03-30T20:41:00.000Z",
  finalizedAt: "2026-03-30T20:42:00.000Z",
  rejectionReason: null,
  isActive: true,
};

describe("/dashboard/resources/[resourceKey]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listReferenceResourceCatalogMock.mockResolvedValue([{
      id: "20000000-0000-4000-8000-000000000001",
      resourceKey: "source-aliases",
      resourceKind: "source-registry",
      label: "Dataset source aliases",
      description: "Canonical source keys and accepted dataset source names.",
      routePath: "/dashboard/resources/source-aliases",
      sortOrder: 30,
      activeVersion: version,
      impact: {
        affectedEngines: ["Tier 1 source forming", "Tier 1 merge products"],
        olderOutputCount: 1,
      },
    }]);
    getReferenceResourcePageMock.mockResolvedValue({
      entries: [],
      nextCursor: null,
      version,
      resource: {
        schemaVersion: 1,
        resourceKey: "source-aliases",
        sourceName: "Fixture",
        sourceRetrievedAt: version.sourceRetrievedAt,
        entries: [],
      },
    });
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(
      PipelineReferenceResourcePage({
        params: Promise.resolve({ resourceKey: "source-aliases" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(getReferenceResourcePageMock).not.toHaveBeenCalled();
  });

  it("returns not found for non-pipeline resource keys", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(
      PipelineReferenceResourcePage({
        params: Promise.resolve({ resourceKey: "country-territory-codes" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getReferenceResourcePageMock).not.toHaveBeenCalled();
  });

  it("renders the exact resource metadata and entry client", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(
      await PipelineReferenceResourcePage({
        params: Promise.resolve({ resourceKey: "source-aliases" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Dataset source aliases" })).toBeTruthy();
    expect(
      screen.getByText("Canonical source keys and accepted dataset source names."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Used by Tier 1 source forming, Tier 1 merge products.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/1 recent output uses an older version/u)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to resources" }).getAttribute("href"),
    ).toBe("/dashboard/resources");
    const client = screen.getByTestId("pipeline-resource-client");
    expect(client.getAttribute("data-resource-key")).toBe("source-aliases");
    expect(client.getAttribute("data-can-manage")).toBe("false");
    expect(
      document.querySelector('[data-smoke-page="pipeline-reference-resource"]'),
    ).toBeTruthy();
  });

  it("passes lifecycle administration to dataset admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    render(
      await PipelineReferenceResourcePage({
        params: Promise.resolve({ resourceKey: "source-aliases" }),
      }),
    );

    expect(
      screen
        .getByTestId("pipeline-resource-client")
        .getAttribute("data-can-manage"),
    ).toBe("true");
  });
});
