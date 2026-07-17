import { describe, expect, it } from "vitest";

import { getPartnerExportDownloadFileName } from "./download-file-name";

const downloadedAt = new Date("2026-07-17T04:15:30.123Z");

describe("partner export download filenames", () => {
  it.each([
    ["csv", "People-Groups-Joshua-Project-2026-07-17T04-15-30Z.csv"],
    [
      "crosswalk",
      "People-Groups-Joshua-Project-2026-07-17T04-15-30Z-crosswalk.json",
    ],
    [
      "validation",
      "People-Groups-Joshua-Project-2026-07-17T04-15-30Z-validation.json",
    ],
  ] as const)("includes the dataset, profile, and download time for %s", (kind, expected) => {
    expect(
      getPartnerExportDownloadFileName({
        datasetName: "People Groups.csv",
        profileFileNameStem: "Joshua Project.csv",
        kind,
        downloadedAt,
      }),
    ).toBe(expected);
  });

  it("sanitizes unsafe fragments and applies readable fallbacks", () => {
    expect(
      getPartnerExportDownloadFileName({
        datasetName: "  ",
        profileFileNameStem: "Joshua/Project:*",
        kind: "csv",
        downloadedAt,
      }),
    ).toBe("dataset-Joshua-Project-2026-07-17T04-15-30Z.csv");
  });
});
