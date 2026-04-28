import type { SmokeRole } from "../types";

export type SmokeProjectContext = {
  role: SmokeRole;
  viewport: "desktop" | "mobile";
};

export function getSmokeProjectContext(projectName: string): SmokeProjectContext {
  const normalizedName = projectName.toLowerCase();

  return {
    role: normalizedName.includes("admin")
      ? "admin"
      : normalizedName.includes("basic")
        ? "basic"
        : normalizedName.includes("pro")
          ? "pro"
        : "anonymous",
    viewport: normalizedName.includes("mobile") ? "mobile" : "desktop",
  };
}
