// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DatasetViewSwitchGrid,
  getRegionTooltipText,
} from "./dataset-view-switch-grid";

describe("DatasetViewSwitchGrid", () => {
  it("uses a short fallback for Globe when no description is configured", () => {
    expect(getRegionTooltipText("Globe", "   ", ["Albania", "Brazil"])).toBe(
      "All countries.",
    );
  });

  it("falls back to the country list for non-Globe regions without descriptions", () => {
    expect(
      getRegionTooltipText("South East Asia", "", ["Thailand", "Vietnam"]),
    ).toBe("Thailand, Vietnam");
  });

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
          thresholdLabel: "Christianity_GSEC",
          thresholdDefinition: "GSEC definition",
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupLabel: "Christianity_Frontier_Group",
          frontierGroupDefinition: "Frontier group definition",
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
          thresholdLabel: "Christianity: GSEC",
          thresholdDefinition: "GSEC definition",
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupLabel: "Christianity: Frontier Group Y/N",
          frontierGroupDefinition: "Frontier group definition",
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
    expect(screen.getByText(/Christianity: GSEC/)).toBeTruthy();
    expect(screen.getByText(/Christianity: Frontier Group Y\/N/)).toBeTruthy();
  });

  it("renders watchlist controls with the supplied display labels and disables them when watchlist is off", () => {
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
          thresholdLabel: "Christianity: GSEC",
          thresholdDefinition: "Global Status of Evangelical Christianity.",
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupLabel: "Christianity: Frontier Group Y/N",
          frontierGroupDefinition:
            "<.1% Christian Adherents and no confirmed sustained movement.",
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
      "Watchlist Christianity: GSEC threshold",
    ) as HTMLInputElement;
    const frontierGroupInput = screen.getByRole("combobox", {
      name: "Watchlist Christianity: Frontier Group Y/N value",
    });

    expect(thresholdInput.value).toBe("2");
    expect(thresholdInput.disabled).toBe(true);
    expect(screen.getByText("Christianity: Frontier Group Y/N")).toBeTruthy();
    expect(
      screen.getByLabelText("View definition for Christianity: GSEC"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "View definition for Christianity: Frontier Group Y/N",
      ),
    ).toBeTruthy();
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
          thresholdLabel: "Christianity: GSEC",
          thresholdDefinition: "GSEC definition",
          threshold: 2,
          minThreshold: 0,
          maxThreshold: 6,
          frontierGroupLabel: "Christianity: Frontier Group Y/N",
          frontierGroupDefinition: "Frontier group definition",
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
      name: "Watchlist Christianity: Frontier Group Y/N value",
    });

    expect(frontierGroupInput).toBeTruthy();
    expect(frontierGroupInput.getAttribute("aria-expanded")).toBe("false");
    expect(frontierGroupInput.textContent?.toLowerCase()).toContain("true");
  });
});
