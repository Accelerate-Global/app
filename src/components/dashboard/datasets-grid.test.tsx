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
  sortOrder: 0,
  fileName: "All People Groups",
  blobUrl: "https://example.com/all-people-groups.csv",
  blobPath: "datasets/all-people-groups.csv",
  isPrimary: true,
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
  it("renders separated download and edit controls in a scroll-safe table", () => {
    const onEditDataset = vi.fn();

    const { container } = render(
      <DatasetsGrid
        datasets={[dataset]}
        canManageDatasets
        onEditDataset={onEditDataset}
      />,
    );

    const scroller = container.querySelector(".overflow-x-auto");
    const header = container.querySelector("[style]");

    expect(scroller?.className).toContain("overflow-x-auto");
    expect(header?.getAttribute("style")).toContain("max-content");
    expect(
      screen
        .getByRole("link", { name: `Download ${dataset.fileName}` })
        .getAttribute("href"),
    ).toBe(`/api/datasets/${dataset.id}/download`);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEditDataset).toHaveBeenCalledWith(dataset.id);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
