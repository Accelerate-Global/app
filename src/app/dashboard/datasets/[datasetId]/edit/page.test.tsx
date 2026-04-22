// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFound, redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getDataset, listDatasetVersions, listDatasets } from "@/lib/datasets";
import DatasetEditPage from "./page";

const datasetEditPageClientSpy = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getDataset: vi.fn(),
  listDatasetVersions: vi.fn(),
  listDatasets: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/dataset-edit-page-client", () => ({
  DatasetEditPageClient: (props: unknown) => {
    datasetEditPageClientSpy(props);
    return null;
  },
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);
const listDatasetVersionsMock = vi.mocked(listDatasetVersions);
const listDatasetsMock = vi.mocked(listDatasets);
const redirectMock = vi.mocked(redirect);
const notFoundMock = vi.mocked(notFound);

function createDataset(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-1",
    backingDatasetId: null,
    sortOrder: 0,
    fileName: "Global",
    blobUrl: "https://example.com/global.csv",
    blobPath: "datasets/global.csv",
    isPrimary: true,
    isPublic: true,
    status: "ready" as const,
    rowCount: 10,
    sizeBytes: 100,
    columns: [
      {
        key: "geo_country_name",
        label: "Geo_Country_Name",
        sourceIndex: 0,
      },
    ],
    hiddenColumnKeys: [],
    tags: [
      {
        id: "tag-1",
        label: "Primary",
        color: "#4c9bff",
      },
    ],
    error: null,
    createdAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function createVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "dataset-version-1",
    datasetId: "dataset-1",
    isCurrent: true,
    fileName: "Global.csv",
    action: "upload" as const,
    actorOwnerId: "supabase-user",
    actorEmail: "admin@example.com",
    status: "ready" as const,
    rowCount: 128,
    sizeBytes: 4096,
    columnCount: 2,
    versionCreatedAt: new Date("2026-04-15T16:00:00.000Z").toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

describe("/dashboard/datasets/[datasetId]/edit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    datasetEditPageClientSpy.mockReset();
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    getDatasetMock.mockResolvedValue(createDataset());
    listDatasetVersionsMock.mockResolvedValue([createVersion()]);
    listDatasetsMock.mockResolvedValue([
      createDataset(),
      createDataset({
        id: "dataset-2",
        fileName: "South Asia",
        isPrimary: false,
        tags: [
          {
            id: "tag-2",
            label: "Regional focus",
            color: "#078bc9",
          },
        ],
      }),
    ]);
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(
      DatasetEditPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin users to the dataset detail page", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "viewer@example.com",
      fullName: "Viewer",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(
      DatasetEditPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/datasets/dataset-1");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/datasets/dataset-1");
  });

  it("renders the edit page and hydrates reusable tags plus initial versions", async () => {
    render(
      await DatasetEditPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
      }),
    );

    expect(screen.getByText("Edit dataset")).toBeTruthy();
    expect(screen.getByText(/Update Global and manage/i)).toBeTruthy();

    const props = datasetEditPageClientSpy.mock.lastCall?.[0] as {
      initialDataset: ReturnType<typeof createDataset>;
      backingDatasetName: string | null;
      availableTags: Array<{ label: string }>;
      initialVersions: ReturnType<typeof createVersion>[];
      actorOwnerId: string;
      workspaceRole: string;
    };

    expect(getDatasetMock).toHaveBeenCalledWith("dataset-1", {
      includeDisabled: true,
    });
    expect(listDatasetsMock).toHaveBeenCalledWith({
      includeDisabled: true,
    });
    expect(listDatasetVersionsMock).toHaveBeenCalledWith("dataset-1");
    expect(props.initialDataset.fileName).toBe("Global");
    expect(props.backingDatasetName).toBeNull();
    expect(props.initialVersions).toEqual([createVersion()]);
    expect(props.availableTags.map((tag) => tag.label)).toEqual([
      "Primary",
      "Regional focus",
    ]);
    expect(props.actorOwnerId).toBe("owner-1");
    expect(props.workspaceRole).toBe("admin");
  });

  it("skips upload history loading for derived dataset views", async () => {
    getDatasetMock.mockResolvedValue(
      createDataset({
        backingDatasetId: "dataset-source-1",
        isPrimary: false,
      }),
    );
    listDatasetsMock.mockResolvedValue([
      createDataset({
        id: "dataset-source-1",
        fileName: "All People Groups",
      }),
      createDataset({
        id: "dataset-1",
        backingDatasetId: "dataset-source-1",
        fileName: "UUPG",
        isPrimary: false,
      }),
    ]);

    render(
      await DatasetEditPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
      }),
    );

    expect(listDatasetVersionsMock).not.toHaveBeenCalled();
    const props = datasetEditPageClientSpy.mock.lastCall?.[0] as {
      backingDatasetName: string | null;
      initialVersions: ReturnType<typeof createVersion>[];
    };
    expect(props.backingDatasetName).toBe("All People Groups");
    expect(props.initialVersions).toEqual([]);
  });

  it("renders not found when the dataset does not exist", async () => {
    getDatasetMock.mockResolvedValue(null);

    await expect(
      DatasetEditPage({
        params: Promise.resolve({ datasetId: "dataset-1" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
