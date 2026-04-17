const SOUTH_EAST_ASIA_PATTERN = /\bSouth East Asia\b/g;

export function isGlobeRegionName(name: string) {
  return name.trim().toLowerCase() === "globe";
}

export function normalizeRegionDisplayName(name: string) {
  return name.trim().replace(SOUTH_EAST_ASIA_PATTERN, "South Asia");
}

export function normalizeRegionDisplayText(text: string) {
  return text.replace(SOUTH_EAST_ASIA_PATTERN, "South Asia");
}
