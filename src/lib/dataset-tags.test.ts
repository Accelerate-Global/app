import { describe, expect, it } from "vitest";

import {
  getDatasetTagIdentity,
  getReusableDatasetTags,
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

  it("dedupes reusable tags by normalized label and color", () => {
    expect(
      getReusableDatasetTags([
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
});
