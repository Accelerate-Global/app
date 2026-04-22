import { normalizeCompatibleRegionName } from "@/lib/canonical-filter-regions";

const LEGACY_GLOBE_PATTERN = /\bGlobe\b/g;
const LEGACY_SOUTH_ASIA_PATTERN = /\bSouth Asia\b/g;
const LEGACY_SOUTH_EAST_ASIA_PATTERN = /\bSouth East Asia\b/g;
const GLOBAL_REGION_NAMES = new Set(["global", "globe"]);

export function isGlobalRegionName(name: string) {
  return GLOBAL_REGION_NAMES.has(name.trim().toLowerCase());
}

export function isGlobeRegionName(name: string) {
  return isGlobalRegionName(name);
}

export function normalizeRegionDisplayName(name: string) {
  return normalizeCompatibleRegionName(name);
}

export function normalizeRegionMatchName(name: string) {
  return normalizeRegionDisplayName(name).toLowerCase();
}

export function normalizeRegionDisplayText(text: string) {
  return text
    .replace(LEGACY_GLOBE_PATTERN, "Global")
    .replace(LEGACY_SOUTH_EAST_ASIA_PATTERN, "Asia, Southeast")
    .replace(LEGACY_SOUTH_ASIA_PATTERN, "Asia, South");
}
