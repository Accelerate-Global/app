export type SmokeRole = "anonymous" | "viewer" | "admin";

export type SmokeRouteSpec = {
  id: string;
  role: SmokeRole;
  pageFile: string;
  path: string;
  pageId?: string;
  heading?: string;
  redirectTo?: string;
  readySelector?: string;
  assertFixtureCoverage?: boolean;
  journeys?: string[];
};
