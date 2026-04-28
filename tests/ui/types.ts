export type SmokeRole = "anonymous" | "pro" | "basic" | "admin";

export type SmokeRouteSpec = {
  id: string;
  role: SmokeRole;
  pageFile: string;
  path: string;
  pageId?: string;
  redirectTo?: string;
  assertFixtureCoverage?: boolean;
  journeys?: string[];
};
