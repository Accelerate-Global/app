export type DatasetViewOption = {
  id: "global" | "region" | "watchlist" | "uupg";
  title: string;
  description: string;
  defaultChecked: boolean;
  aliases: string[];
};

export const DATASET_VIEW_OPTIONS = [
  {
    id: "global",
    title: "Global",
    description:
      "Contains all unique people groups from IMB, Joshua Project, Accelerate, Etnopedia, and World Christian Database.",
    defaultChecked: true,
    aliases: ["global"],
  },
  {
    id: "region",
    title: "Region",
    description: "A grouping of people groups based on geography.",
    defaultChecked: false,
    aliases: ["region"],
  },
  {
    id: "watchlist",
    title: "Watchlist",
    description:
      "People groups unengaged or would be unengaged if the current mission work stopped today.",
    defaultChecked: false,
    aliases: ["watchlist"],
  },
  {
    id: "uupg",
    title: "UUPG",
    description: "People groups who have no record of engagement among them.",
    defaultChecked: false,
    aliases: ["uupg", "uupg's", "uupgs"],
  },
] as const satisfies ReadonlyArray<DatasetViewOption>;

function normalizeDatasetViewName(value: string) {
  return value.trim().toLowerCase();
}

export function getDatasetViewOption(name: string) {
  const normalizedName = normalizeDatasetViewName(name);

  return DATASET_VIEW_OPTIONS.find((option) =>
    option.aliases.some((alias) => normalizeDatasetViewName(alias) === normalizedName),
  );
}
