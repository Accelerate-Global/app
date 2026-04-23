import { describe, expect, it } from "vitest";

import {
  composeDatasetTagsWithClassification,
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

  it("dedupes reusable tags by normalized label and color while excluding reserved classification tags", () => {
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
      ]),
    ).toEqual([
      {
        id: "tag-1",
        label: "Watchlist",
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
