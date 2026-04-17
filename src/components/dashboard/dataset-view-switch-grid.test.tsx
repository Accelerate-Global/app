// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DatasetViewSwitchGrid,
  getRegionTooltipText,
} from "./dataset-view-switch-grid";

const baseRegionCard = {
  enabled: false,
  supported: true,
  selectors: [],
  onSelectorChange: vi.fn(),
};

const baseWatchlistCard = {
  enabled: false,
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
};

const baseUupgCard = {
  enabled: false,
  supported: true,
  fieldLabel: "Global Engagement Anywhere",
  fieldDefinition: "UUPG definition",
  onEnabledChange: vi.fn(),
};

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
        regionCard={baseRegionCard}
        watchlistCard={{
          ...baseWatchlistCard,
          thresholdLabel: "Christianity_GSEC",
          frontierGroupLabel: "Christianity_Frontier_Group",
        }}
        uupgCard={{
          ...baseUupgCard,
          supported: false,
        }}
      />,
    );

    expect(screen.getByText(/This dataset does not include/i)).toBeTruthy();
    expect(screen.getByText(/Global Engagement Anywhere/)).toBeTruthy();
    expect(screen.queryByLabelText("Toggle UUPG")).toBeNull();
  });

  it("shows an unavailable message when Watchlist filtering is not supported", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={{
          ...baseWatchlistCard,
          supported: false,
        }}
        uupgCard={baseUupgCard}
      />,
    );

    expect(screen.getByText(/This dataset does not include/i)).toBeTruthy();
    expect(screen.getByText(/Christianity: GSEC/)).toBeTruthy();
    expect(screen.getByText(/Christianity: Frontier Group Y\/N/)).toBeTruthy();
  });

  it("renders region selectors without a card-level toggle", () => {
    const onSelectorChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={{
          enabled: true,
          supported: true,
          selectors: [
            {
              id: "globe",
              label: "Globe",
              checked: true,
              description: "",
              countries: ["Nepal"],
            },
          ],
          onSelectorChange,
        }}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
      />,
    );

    expect(screen.queryByLabelText("Toggle Region")).toBeNull();

    fireEvent.click(screen.getByLabelText("Toggle Globe"));

    expect(onSelectorChange).toHaveBeenCalledWith("globe", false);
  });

  it("renders watchlist controls with the supplied display labels and disables them when watchlist is off", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={{
          ...baseWatchlistCard,
          thresholdDefinition: "Global Status of Evangelical Christianity.",
          frontierGroupDefinition:
            "<.1% Christian Adherents and no confirmed sustained movement.",
        }}
        uupgCard={baseUupgCard}
      />,
    );

    const thresholdInput = screen.getByLabelText(
      "Watchlist Christianity: GSEC threshold",
    ) as HTMLInputElement;
    const selectedBooleanButton = screen.getByRole("button", {
      name: "Set Watchlist Christianity: Frontier Group Y/N value to TRUE",
    });
    const unselectedBooleanButton = screen.getByRole("button", {
      name: "Set Watchlist Christianity: Frontier Group Y/N value to FALSE",
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
    expect(selectedBooleanButton.getAttribute("aria-pressed")).toBe("true");
    expect(unselectedBooleanButton.getAttribute("aria-pressed")).toBe("false");
    expect((selectedBooleanButton as HTMLButtonElement).disabled).toBe(true);
    expect((unselectedBooleanButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders the watchlist frontier group boolean selector as segmented buttons when watchlist is enabled", () => {
    const onFrontierGroupValueChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          onFrontierGroupValueChange,
        }}
        uupgCard={baseUupgCard}
      />,
    );

    const trueButton = screen.getByRole("button", {
      name: "Set Watchlist Christianity: Frontier Group Y/N value to TRUE",
    });
    const falseButton = screen.getByRole("button", {
      name: "Set Watchlist Christianity: Frontier Group Y/N value to FALSE",
    });

    expect(
      screen.getByRole("group", {
        name: "Watchlist Christianity: Frontier Group Y/N value",
      }),
    ).toBeTruthy();
    expect(trueButton.getAttribute("aria-pressed")).toBe("true");
    expect(falseButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(falseButton);

    expect(onFrontierGroupValueChange).toHaveBeenCalledWith(false);
  });

  it("renders the UUPG field as the only toggle inside the card", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          fieldDefinition: "Tracks whether engagement exists anywhere.",
        }}
      />,
    );

    expect(screen.queryByLabelText("Toggle UUPG")).toBeNull();
    expect(screen.getByText("Global Engagement Anywhere")).toBeTruthy();
    expect(
      screen.getByLabelText("View definition for Global Engagement Anywhere"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Toggle Global Engagement Anywhere")).toBeTruthy();
  });
});
