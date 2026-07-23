export type SmokeRole = "anonymous" | "pro" | "basic" | "admin";

export type SmokeRequestMock = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  status?: number;
  responseBody: unknown;
};

export type SmokeRouteSpec = {
  id: string;
  role: SmokeRole;
  pageFile: string;
  path: string;
  pageId?: string;
  redirectTo?: string;
  assertFixtureCoverage?: boolean;
  journeys?: string[];
  requestMocks?: SmokeRequestMock[];
};
