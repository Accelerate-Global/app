import { describe, expect, it } from "vitest";

import {
  composeDatasetTagsWithWorkspaceVisibility,
  composeDatasetTagsWithClassification,
  DATASET_PRIVATE_TAG,
  getEditableDatasetTags,
  getDatasetClassification,
  getDatasetTagIdentity,
  getDatasetTagsWithoutClassification,
  getDatasetTitleFromTags,
  getReusableDatasetTags,
  hasExactDatasetClassificationTag,
  normalizeDatasetTags,
} from "@/lib/dataset-tags";

describe("dataset-tags", () => {
  it("normalizes dataset tag ids, labels, and colors", () => {
    const [tag] = normalizeDatasetTags([
      {
        id: " tag-1 ",
        label: " Watchlist ",
        color: "262531",
      },
    ]);

    expect(tag).toEqual({
      id: "tag-1",
      label: "Watchlist",
      color: "#262531",
    });
  });

  it("uses label and color to identify reusable tags", () => {
    expect(
      getDatasetTagIdentity({
        label: "Watchlist",
        color: "#262531",
      }),
    ).toBe(
      getDatasetTagIdentity({
        label: " watchlist ",
        color: "262531",
      }),
    );
  });

  it("dedupes reusable tags while excluding reserved classification and private tags", () => {
    expect(
      getReusableDatasetTags([
        {
          id: "classification",
          label: "PGAC",
          color: "#fcab2a",
        },
        {
          id: "tag-1",
          label: "Watchlist",
          color: "#262531",
        },
        {
          id: "tag-2",
          label: " watchlist ",
          color: "262531",
        },
        {
          id: "private",
          label: " PRIVATE ",
          color: "#078bc9",
        },
      ]),
    ).toEqual([
      {
        id: "tag-1",
        label: "Watchlist",
        color: "#262531",
      },
    ]);
  });

  it("composes one canonical red Private tag when workspace visibility is disabled", () => {
    expect(
      composeDatasetTagsWithWorkspaceVisibility(
        [
          {
            id: "tag-pgac",
            label: "PGAC",
            color: "#fcab2a",
          },
          {
            id: "tag-priority",
            label: "Priority",
            color: "#262531",
          },
          {
            id: "legacy-private",
            label: " private ",
            color: "#078bc9",
          },
          {
            id: "duplicate-private",
            label: "PRIVATE",
            color: "#fcab2a",
          },
        ],
        false,
      ),
    ).toEqual([
      {
        id: "tag-pgac",
        label: "PGAC",
        color: "#fcab2a",
      },
      {
        id: "tag-priority",
        label: "Priority",
        color: "#262531",
      },
      DATASET_PRIVATE_TAG,
    ]);
  });

  it("removes every Private variant when workspace visibility is enabled", () => {
    expect(
      composeDatasetTagsWithWorkspaceVisibility(
        [
          DATASET_PRIVATE_TAG,
          {
            id: "tag-priority",
            label: "Priority",
            color: "#262531",
          },
          {
            id: "legacy-private",
            label: "PRIVATE",
            color: "#078bc9",
          },
        ],
        true,
      ),
    ).toEqual([
      {
        id: "tag-priority",
        label: "Priority",
        color: "#262531",
      },
    ]);
  });

  it("excludes classification and Private tags from editable tag lists", () => {
    expect(
      getEditableDatasetTags([
        {
          id: "classification",
          label: "PGIC",
          color: "#078bc9",
        },
        DATASET_PRIVATE_TAG,
        {
          id: "tag-priority",
          label: "Priority",
          color: "#262531",
        },
      ]),
    ).toEqual([
      {
        id: "tag-priority",
        label: "Priority",
        color: "#262531",
      },
    ]);
  });

  it("extracts a reserved dataset classification from tags", () => {
    expect(
      getDatasetClassification([
        {
          id: "classification",
          label: " pgic ",
          color: "#078bc9",
        },
      ]),
    ).toBe("PGIC");
  });

  it("composes a single reserved classification tag alongside editable tags", () => {
    expect(
      composeDatasetTagsWithClassification(
        [
          {
            id: "classification",
            label: "PGAC",
            color: "#fcab2a",
          },
          {
            id: "tag-1",
            label: "Regional focus",
            color: "#078bc9",
          },
        ],
        "PGIC",
      ),
    ).toEqual([
      {
        id: "tag-1",
        label: "Regional focus",
        color: "#078bc9",
      },
      {
        id: "classification",
        label: "PGIC",
        color: "#078bc9",
      },
    ]);
  });

  it("strips reserved classification tags from editable tag lists", () => {
    expect(
      getDatasetTagsWithoutClassification([
        {
          id: "classification",
          label: "PGAC",
          color: "#fcab2a",
        },
        {
          id: "tag-1",
          label: "Priority",
          color: "#262531",
        },
      ]),
    ).toEqual([
      {
        id: "tag-1",
        label: "Priority",
        color: "#262531",
      },
    ]);
  });

  it("uses a PGAC fallback title when classification tags are missing or invalid", () => {
    expect(
      getDatasetTitleFromTags([
        {
          id: "tag-1",
          label: "Priority",
          color: "#262531",
        },
      ]),
    ).toBe("PGAC Dataset");

    expect(
      getDatasetTitleFromTags([
        {
          id: "pgac",
          label: "PGAC",
          color: "#fcab2a",
        },
        {
          id: "pgic",
          label: "PGIC",
          color: "#078bc9",
        },
      ]),
    ).toBe("PGAC Dataset");

    expect(
      hasExactDatasetClassificationTag([
        {
          id: "pgac",
          label: "PGAC",
          color: "#fcab2a",
        },
        {
          id: "pgic",
          label: "PGIC",
          color: "#078bc9",
        },
      ]),
    ).toBe(false);
  });
});
