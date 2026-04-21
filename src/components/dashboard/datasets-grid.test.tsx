// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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
  isPublic: true,
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

    const scroller = container.querySelector(".overflow-x-auto");
    const header = container.querySelector("[style]");

    expect(scroller?.className).toContain("overflow-x-auto");
    expect(header?.getAttribute("style")).toContain("10.5rem");
    expect(screen.getByRole("heading", { name: "Datasets" })).toBeTruthy();
    expect(
      screen.getByText(
        "Source datasets and derived views available to browse, download, and manage.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Tags").className).toContain("justify-center");
    expect(screen.getByText("People Groups").className).toContain("justify-center");
    expect(screen.getByText("Backed by All People Groups")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: `Download ${dataset.fileName}` })
        .getAttribute("href"),
    ).toBe(`/api/datasets/${dataset.id}/download`);

    const editLink = screen.getAllByRole("link", { name: "Edit" })[0];
    expect(editLink.getAttribute("href")).toBe(`/dashboard/datasets/${dataset.id}/edit`);

    expect(pushMock).not.toHaveBeenCalled();
  });
});
