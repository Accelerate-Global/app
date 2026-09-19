export type UupgFilterOptions = Readonly<{
  globalEngagementAnywhereEnabled: boolean;
  frontierGroupEnabled: boolean;
}>;

export type UupgFilterInputValue = boolean | null | "invalid";

export type UupgFilterValues = Readonly<{
  globallyEngaged: UupgFilterInputValue;
  frontierGroup: UupgFilterInputValue;
}>;

export function isValidUupgFilterOptions(options: UupgFilterOptions) {
  return (
    options.globalEngagementAnywhereEnabled || options.frontierGroupEnabled
  );
}

export function evaluateUupgFilter(
  options: UupgFilterOptions,
  values: UupgFilterValues,
) {
  if (!isValidUupgFilterOptions(options)) {
    throw new Error("At least one UUPG criterion must be enabled.");
  }

  const globallyEngagedMatches =
    values.globallyEngaged === false || values.globallyEngaged === null;
  const frontierGroupMatches =
    values.frontierGroup === true || values.frontierGroup === null;

  return (
    (!options.globalEngagementAnywhereEnabled || globallyEngagedMatches) &&
    (!options.frontierGroupEnabled || frontierGroupMatches)
  );
}
