// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
import UploadPage from "./page";

const datasetUploadClientSpy = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/datasets", () => ({ getDataset: vi.fn() }));
vi.mock("@/components/dashboard/dataset-upload-client", () => ({
  DatasetUploadClient: (props: unknown) => {
    datasetUploadClientSpy(props);
    return <div data-testid="replacement-upload" />;
  },
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/dashboard/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("redirects new uploads into onboarding", async () => {
    await expect(UploadPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/datasets/new?source=csv",
    );
  });

  it("preserves replacement rendering", async () => {
    getDatasetMock.mockResolvedValue({
      id: "dataset-1",
      backingDatasetId: null,
      sortOrder: 0,
      fileName: "People.csv",
      blobUrl: "https://example.com/people.csv",
      blobPath: "datasets/people.csv",
      isPrimary: false,
      isWorkspaceVisible: true,
      status: "ready",
      rowCount: 1,
      sizeBytes: 20,
      columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      hiddenColumnKeys: [],
      defaultFilters: null,
      tags: [],
      error: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    render(
      await UploadPage({ searchParams: Promise.resolve({ replace: "dataset-1" }) }),
    );
    expect(screen.getByRole("heading", { name: "Replace dataset" })).toBeTruthy();
    expect(screen.getByTestId("replacement-upload")).toBeTruthy();
    expect(datasetUploadClientSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ actorOwnerId: expect.anything() }),
    );
  });
});
