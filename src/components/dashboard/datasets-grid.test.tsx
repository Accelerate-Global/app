// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatasetsGrid } from "./datasets-grid";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const dataset = {
  id: "dataset-1",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "All People Groups",
  blobUrl: "https://example.com/all-people-groups.csv",
  blobPath: "datasets/all-people-groups.csv",
  isPrimary: true,
  isWorkspaceVisible: true,
  status: "ready" as const,
  rowCount: 12507,
  sizeBytes: 4096,
  columns: [
    {
      key: "people_group_id",
      label: "People Group ID",
      sourceIndex: 0,
    },
  ],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [
    {
      id: "tag-pgac",
      label: "PGAC",
      color: "#E3A33A",
    },
    {
      id: "tag-primary",
      label: "Primary",
      color: "#4C9BFF",
    },
  ],
  error: null,
  createdAt: new Date("2026-04-17T12:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-04-17T12:00:00.000Z").toISOString(),
};

describe("DatasetsGrid", () => {
  it("renders section copy, centered column headers, and derived view source labels", () => {
    const derivedDataset = {
      ...dataset,
      id: "dataset-2",
      backingDatasetId: dataset.id,
      fileName: "UUPG",
      isPrimary: false,
      rowCount: 3524,
      tags: [
        {
          id: "tag-uupg",
          label: "UUPG",
          color: "#f4bf75",
        },
      ],
    };
    const { container } = render(
      <DatasetsGrid
        datasets={[dataset, derivedDataset]}
        canManageDatasets
      />,
    );

    const scroller = container.querySelector("[class*='md:overflow-x-auto']");
    const header = container.querySelector("[style]");
    const datasetRow = container.querySelector("[data-smoke-dataset-row='dataset-1']");
    const tagsRegion = screen.getByLabelText("Tags for All People Groups");

    expect(scroller?.className).toContain("md:overflow-x-auto");
    expect(header?.className).toContain("hidden");
    expect(header?.className).toContain("md:grid");
    expect(header?.getAttribute("style")).toContain("10.5rem");
    expect(datasetRow?.className).toContain("grid-cols-[minmax(0,1fr)]");
    expect(datasetRow?.className).toContain(
      "md:grid-cols-[var(--dataset-grid-template)]",
    );
    expect(tagsRegion.className).toContain("justify-start");
    expect(tagsRegion.className).toContain("md:justify-center");
    expect(screen.getByRole("heading", { name: "Datasets" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add dataset" }).getAttribute("href")).toBe(
      "/dashboard/datasets/new",
    );
    expect(
      screen.getByText(
        "Source datasets and derived views available to browse, download, and manage.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Tags").className).toContain("justify-center");
    expect(screen.getAllByText("People Groups")[0]?.className).toContain(
      "justify-center",
    );
    expect(screen.getByText("Backed by All People Groups")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: `Download ${dataset.fileName}` })
        .getAttribute("href"),
    ).toBe(`/api/datasets/${dataset.id}/download`);

    const editLink = screen.getAllByRole("link", { name: "Edit" })[0];
    expect(editLink.getAttribute("href")).toBe(`/dashboard/datasets/${dataset.id}/edit`);

    fireEvent.click(datasetRow!);
    expect(pushMock).toHaveBeenCalledWith(`/dashboard/datasets/${dataset.id}`);
  });

  it("hides Add dataset from non-admin viewers", () => {
    render(<DatasetsGrid datasets={[dataset]} canManageDatasets={false} />);
    expect(screen.queryByRole("link", { name: "Add dataset" })).toBeNull();
  });

  it("renders the red Private tag only on restricted dataset rows", () => {
    const restrictedDataset = {
      ...dataset,
      id: "dataset-private",
      fileName: "Restricted Dataset",
      isPrimary: false,
      isWorkspaceVisible: false,
      tags: [
        ...dataset.tags,
        {
          id: "dataset-visibility-private",
          label: "Private",
          color: "#dc2626",
        },
      ],
    };

    const { container } = render(
      <DatasetsGrid
        datasets={[dataset, restrictedDataset]}
        canManageDatasets
      />,
    );

    const visibleRow = container.querySelector(
      '[data-smoke-dataset-row="dataset-1"]',
    );
    const restrictedRow = container.querySelector(
      '[data-smoke-dataset-row="dataset-private"]',
    );
    const privateTag = screen.getByText("Private");

    expect(visibleRow?.textContent).not.toContain("Private");
    expect(restrictedRow?.textContent).toContain("Private");
    expect(privateTag.getAttribute("style")).toContain("rgba(220, 38, 38");
  });
});
