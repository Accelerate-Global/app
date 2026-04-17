// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DatasetViewSwitchGrid,
  getRegionTooltipText,
} from "./dataset-view-switch-grid";

const baseRegionCard = {
  enabled: true,
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
  engagementPhaseLabel: "Engage: 8 Phases of Engagement",
  engagementPhaseDefinition: "Engagement phase definition",
  engagementPhaseThreshold: 6,
  minEngagementPhaseThreshold: 0,
  maxEngagementPhaseThreshold: 7,
  evangelicalBelieversLabel: "Evangelical Believers",
  evangelicalBelieversDefinition:
    "Calculated as PG_Population * (Percent_Evangelical_PGAC / 100).",
  evangelicalBelieversThreshold: 1000,
  minEvangelicalBelieversThreshold: 0,
  maxEvangelicalBelieversThreshold: 1_000_000_000,
  evangelicalPercentLabel: "Evangelical %",
  evangelicalPercentDefinition: "Percent evangelical definition",
  evangelicalPercentThreshold: 0.05,
  minEvangelicalPercentThreshold: 0,
  maxEvangelicalPercentThreshold: 100,
  frontierGroupLabel: "Christianity: Frontier Group Y/N",
  frontierGroupDefinition: "Frontier group definition",
  frontierGroupValue: true,
  onEnabledChange: vi.fn(),
  onThresholdChange: vi.fn(),
  onEngagementPhaseThresholdChange: vi.fn(),
  onEvangelicalBelieversThresholdChange: vi.fn(),
  onEvangelicalPercentThresholdChange: vi.fn(),
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

  it("renders collapsed filter sections with compact summaries", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
      />,
    );

    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.getByText("No regions configured")).toBeTruthy();
    expect(screen.getAllByText("Off")).toHaveLength(2);
    expect(
      screen.queryByText("A grouping of people groups based on geography."),
    ).toBeNull();
    expect(
      screen.queryByText(
        "People groups unengaged or would be unengaged if the current mission work stopped today.",
      ),
    ).toBeNull();
  });

  it("renders enabled watchlist summaries as separate lines", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={{ ...baseWatchlistCard, enabled: true }}
        uupgCard={baseUupgCard}
      />,
    );

    expect(screen.getByText("Christianity: GSEC <= 2")).toBeTruthy();
    expect(screen.getByText("Engage: 8 Phases of Engagement >= 6")).toBeTruthy();
    expect(screen.getByText("Evangelical % >= 0.05")).toBeTruthy();
    expect(screen.getByText("Evangelical Believers <= 1000")).toBeTruthy();
    expect(
      screen.getByText("Christianity: Frontier Group Y/N: True"),
    ).toBeTruthy();
  });

  it("expands the region section and keeps selector toggles working", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Region filters" }));

    expect(
      screen.getByText("A grouping of people groups based on geography."),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Toggle Globe"));

    expect(onSelectorChange).toHaveBeenCalledWith("globe", false);
  });

  it("reveals watchlist descriptions and controls only when expanded", () => {
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

    expect(
      screen.queryByLabelText("Watchlist Christianity: GSEC threshold"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const thresholdInput = screen.getByLabelText(
      "Watchlist Christianity: GSEC threshold",
    ) as HTMLInputElement;
    const thresholdLabel = screen.getByText("Christianity: GSEC");
    const thresholdInfo = screen.getByLabelText(
      "View definition for Christianity: GSEC",
    );
    const thresholdControl = thresholdInput.closest(
      "[data-slot='number-field-group']",
    );
    const thresholdOperator = thresholdControl?.querySelector(
      "[data-slot='number-field-operator']",
    ) as HTMLElement | null;
    const thresholdDecrement = screen.getByLabelText(
      "Decrease Christianity: GSEC threshold",
    );

    expect(
      screen.getByText(
        "People groups unengaged or would be unengaged if the current mission work stopped today.",
      ),
    ).toBeTruthy();
    expect(thresholdInput.value).toBe("2");
    expect(thresholdInput.disabled).toBe(true);
    expect(
      thresholdLabel.compareDocumentPosition(thresholdInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thresholdOperator?.textContent,
    ).toBe("<=");
    expect(thresholdOperator).toBeTruthy();
    if (!thresholdOperator) {
      throw new Error("Expected threshold operator to render inside the control");
    }
    expect(
      thresholdOperator.compareDocumentPosition(thresholdDecrement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thresholdDecrement.compareDocumentPosition(thresholdInput) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Watchlist Evangelical Believers threshold"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Watchlist Evangelical % threshold"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Watchlist Engage: 8 Phases of Engagement threshold"),
    ).toBeTruthy();
  });

  it("keeps the watchlist segmented control interactive when the section is expanded", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const frontierLabel = screen.getByText("Christianity: Frontier Group Y/N");
    const frontierInfo = screen.getByLabelText(
      "View definition for Christianity: Frontier Group Y/N",
    );
    const falseButton = screen.getByRole("button", {
      name: "Set Watchlist Christianity: Frontier Group Y/N value to FALSE",
    });

    expect(
      frontierLabel.compareDocumentPosition(frontierInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("=")).toBeNull();

    fireEvent.click(falseButton);

    expect(onFrontierGroupValueChange).toHaveBeenCalledWith(false);
  });

  it("reveals the UUPG field metadata when expanded while keeping the toggle in the section header", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          fieldLabel: "Engage: Global Engagement Anywhere? (Y/N)",
          fieldDefinition: "Tracks whether engagement exists anywhere.",
        }}
      />,
    );

    expect(screen.getByText("On")).toBeTruthy();
    expect(screen.getByLabelText("Toggle UUPG")).toBeTruthy();
    expect(
      screen.queryByLabelText(
        "View definition for Engage: Global Engagement Anywhere? (Y/N)",
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "UUPG filters" }));

    expect(
      screen.getByText("Engage: Global Engagement Anywhere? (Y/N)"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "View definition for Engage: Global Engagement Anywhere? (Y/N)",
      ),
    ).toBeTruthy();
  });

  it("shows unavailable summaries for unsupported filters", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{ ...baseRegionCard, supported: false }}
        watchlistCard={{ ...baseWatchlistCard, supported: false }}
        uupgCard={{ ...baseUupgCard, supported: false }}
      />,
    );

    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
  });

  it("applies custom classes to the root panel", () => {
    const { container } = render(
      <DatasetViewSwitchGrid
        className="border-0 shadow-none"
        regionCard={baseRegionCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
      />,
    );

    const root = container.firstElementChild as HTMLDivElement | null;

    expect(root).toBeTruthy();
    expect(root?.className).toContain("border-0");
    expect(root?.className).toContain("shadow-none");
  });
});
