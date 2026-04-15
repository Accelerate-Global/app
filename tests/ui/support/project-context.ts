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
      : normalizedName.includes("viewer")
        ? "viewer"
        : "anonymous",
    viewport: normalizedName.includes("mobile") ? "mobile" : "desktop",
  };
}
