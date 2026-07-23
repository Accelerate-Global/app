// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  listPipelineFlowRuns,
  listPipelineScheduleStates,
} from "@/lib/pipeline-operations";

import PipelineOperationsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-operations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-operations")>(
    "@/lib/pipeline-operations",
  );
  return {
    ...actual,
    listPipelineFlowRuns: vi.fn(),
    listPipelineScheduleStates: vi.fn(),
  };
});
vi.mock("@/components/pipeline-operations/pipeline-operations-client", () => ({
  PipelineOperationsClient: () => <div>Operations client</div>,
}));

const admin = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/admin/pipeline-operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listPipelineFlowRuns).mockResolvedValue([]);
    vi.mocked(listPipelineScheduleStates).mockResolvedValue([]);
  });

  it("redirects anonymous and non-admin users", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    await expect(PipelineOperationsPage()).rejects.toThrow("NEXT_REDIRECT:/");
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ...admin,
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });
    await expect(PipelineOperationsPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("renders the admin operations page and literal smoke marker", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    render(await PipelineOperationsPage());
    expect(screen.getByRole("heading", { name: "Pipeline Operations" })).toBeTruthy();
    expect(
      document.querySelector('[data-smoke-page="pipeline-operations"]'),
    ).toBeTruthy();
  });
});
