import { describe, expect, it } from "vitest";

import { isAuthorizedPipelineScheduleRequest } from "./schedule-auth";

function request(value?: string) {
  return new Request("https://example.test/api/internal/pipeline-operations/run", {
    headers: value ? { authorization: value } : undefined,
  });
}

describe("pipeline schedule authentication", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedPipelineScheduleRequest(request("Bearer secret"), "secret")).toBe(true);
    expect(isAuthorizedPipelineScheduleRequest(request("Bearer wrong"), "secret")).toBe(false);
    expect(isAuthorizedPipelineScheduleRequest(request(), "secret")).toBe(false);
    expect(isAuthorizedPipelineScheduleRequest(request("Bearer secret"), "")).toBe(false);
  });
});
