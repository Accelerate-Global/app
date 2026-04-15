// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatasetViewSwitchGrid } from "./dataset-view-switch-grid";

describe("DatasetViewSwitchGrid", () => {
  it("shows an unavailable message when UUPG filtering is not supported", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: false,
          supported: true,
          selectors: [],
          onEnabledChange: vi.fn(),
          onSelectorChange: vi.fn(),
        }}
        watchlistCard={{
          enabled: false,
          supported: true,
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupValue: true,
          onEnabledChange: vi.fn(),
          onThresholdChange: vi.fn(),
          onFrontierGroupValueChange: vi.fn(),
        }}
        uupgCard={{
          enabled: false,
          supported: false,
          onEnabledChange: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByText(/This dataset does not include/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Engage_Global_Engagement_Anywhere/),
    ).toBeTruthy();
  });

  it("shows an unavailable message when Watchlist filtering is not supported", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: false,
          supported: true,
          selectors: [],
          onEnabledChange: vi.fn(),
          onSelectorChange: vi.fn(),
        }}
        watchlistCard={{
          enabled: false,
          supported: false,
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupValue: true,
          onEnabledChange: vi.fn(),
          onThresholdChange: vi.fn(),
          onFrontierGroupValueChange: vi.fn(),
        }}
        uupgCard={{
          enabled: false,
          supported: true,
          onEnabledChange: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByText(/This dataset does not include/i),
    ).toBeTruthy();
    expect(screen.getByText(/Christianity_GSEC/)).toBeTruthy();
    expect(screen.getByText(/Christianity_Frontier_Group/)).toBeTruthy();
  });

  it("renders the watchlist threshold control and disables it when watchlist is off", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: false,
          supported: true,
          selectors: [],
          onEnabledChange: vi.fn(),
          onSelectorChange: vi.fn(),
        }}
        watchlistCard={{
          enabled: false,
          supported: true,
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupValue: true,
          onEnabledChange: vi.fn(),
          onThresholdChange: vi.fn(),
          onFrontierGroupValueChange: vi.fn(),
        }}
        uupgCard={{
          enabled: false,
          supported: true,
          onEnabledChange: vi.fn(),
        }}
      />,
    );

    const thresholdInput = screen.getByLabelText(
      "Watchlist Christianity_GSEC threshold",
    ) as HTMLInputElement;
    const frontierGroupInput = screen.getByRole("combobox", {
      name: "Watchlist Christianity_Frontier_Group value",
    });

    expect(thresholdInput.value).toBe("2");
    expect(thresholdInput.disabled).toBe(true);
    expect(screen.getByText("Christianity_Frontier_Group")).toBeTruthy();
    expect(frontierGroupInput.textContent?.toLowerCase()).toContain("true");
  });

  it("renders the watchlist frontier group boolean selector when watchlist is enabled", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: false,
          supported: true,
          selectors: [],
          onEnabledChange: vi.fn(),
          onSelectorChange: vi.fn(),
        }}
        watchlistCard={{
          enabled: true,
          supported: true,
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupValue: true,
          onEnabledChange: vi.fn(),
          onThresholdChange: vi.fn(),
          onFrontierGroupValueChange: vi.fn(),
        }}
        uupgCard={{
          enabled: false,
          supported: true,
          onEnabledChange: vi.fn(),
        }}
      />,
    );

    const frontierGroupInput = screen.getByRole("combobox", {
      name: "Watchlist Christianity_Frontier_Group value",
    });

    expect(frontierGroupInput).toBeTruthy();
    expect(frontierGroupInput.getAttribute("aria-expanded")).toBe("false");
    expect(frontierGroupInput.textContent?.toLowerCase()).toContain("true");
  });
});
