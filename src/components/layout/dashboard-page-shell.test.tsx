// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DASHBOARD_CONTENT_WIDTH_CLASS,
  DashboardPageShell,
} from "@/components/layout/dashboard-page-shell";

describe("DashboardPageShell", () => {
  it("applies the shared desktop dashboard width and default spacing", () => {
    render(<DashboardPageShell>Dashboard content</DashboardPageShell>);

    const shell = screen.getByText("Dashboard content");

    expect(shell?.className).toContain(DASHBOARD_CONTENT_WIDTH_CLASS);
    expect(shell?.className).toContain("gap-8");
  });

  it("supports compact dashboard spacing without changing width", () => {
    render(<DashboardPageShell gap="compact">Compact content</DashboardPageShell>);

    const shell = screen.getByText("Compact content");

    expect(shell?.className).toContain(DASHBOARD_CONTENT_WIDTH_CLASS);
    expect(shell?.className).toContain("gap-6");
  });
});
