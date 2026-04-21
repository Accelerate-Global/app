// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_POPULATION_BELIEVERS_RULE } from "@/lib/evangelical-population-believers-rule";

import {
  DatasetViewSwitchGrid,
  getRegionTooltipText,
} from "./dataset-view-switch-grid";

const baseRegionCard = {
  supported: true,
  selectors: [],
  onSelectorChange: vi.fn(),
};

const baseCountryCard = {
  enabled: false,
  supported: true,
  searchValue: "",
  availableCountries: ["Egypt", "Jordan", "Turkey"],
  visibleCountries: ["Egypt", "Jordan", "Turkey"],
  selectedCountries: [] as string[],
  hasExplicitSelection: false,
  includeAlternateCountries: false,
  supportsAlternateCountries: true,
  onEnabledChange: vi.fn(),
  onIncludeAlternateCountriesChange: vi.fn(),
  onSearchChange: vi.fn(),
  onToggleCountry: vi.fn(),
  onSelectVisible: vi.fn(),
  onClearVisible: vi.fn(),
};

const baseWatchlistCard = {
  enabled: false,
  supported: true,
  thresholdLabel: "Christianity: GSEC",
  thresholdDefinition: "GSEC definition",
  thresholdEnabled: true,
  threshold: 2,
  minThreshold: 0,
  maxThreshold: 6,
  engagementPhaseLabel: "Engage: 8 Phases of Engagement",
  engagementPhaseDefinition: "Engagement phase definition",
  engagementPhaseEnabled: true,
  engagementPhaseThreshold: 6,
  minEngagementPhaseThreshold: 0,
  maxEngagementPhaseThreshold: 7,
  populationBelieversRuleLabel: "Population vs Evangelical Believers",
  populationBelieversRuleDefinition:
    "Build a tiered minimum-believers rule by population.",
  populationBelieversRuleEnabled: true,
  populationBelieversRule: DEFAULT_POPULATION_BELIEVERS_RULE,
  frontierGroupLabel: "Christianity: Frontier Group Y/N",
  frontierGroupDefinition: "Frontier group definition",
  frontierGroupEnabled: true,
  frontierGroupValue: true,
  onEnabledChange: vi.fn(),
  onThresholdEnabledChange: vi.fn(),
  onThresholdChange: vi.fn(),
  onEngagementPhaseEnabledChange: vi.fn(),
  onEngagementPhaseThresholdChange: vi.fn(),
  onPopulationBelieversRuleEnabledChange: vi.fn(),
  onPopulationBelieversRuleChange: vi.fn(),
  onFrontierGroupEnabledChange: vi.fn(),
  onFrontierGroupValueChange: vi.fn(),
};

const baseUupgCard = {
  enabled: false,
  supported: true,
  fieldLabel: "Global Engagement Anywhere",
  fieldDefinition: "UUPG definition",
  onEnabledChange: vi.fn(),
};

const baseHotspotsCard = {
  enabled: false,
  supported: true,
  metric: "unique_uupgs" as const,
  countryCount: 10,
  minCountryCount: 1,
  maxCountryCount: 500,
  onEnabledChange: vi.fn(),
  onMetricChange: vi.fn(),
  onCountryCountChange: vi.fn(),
};

describe("DatasetViewSwitchGrid", () => {
  it("uses a short fallback for Globe when no description is configured", () => {
    expect(getRegionTooltipText("Globe", "   ", ["Albania", "Brazil"])).toBe(
      "All countries.",
    );
  });

  it("falls back to the country list for non-global regions without descriptions", () => {
    expect(
      getRegionTooltipText("South East Asia", "", ["Thailand", "Vietnam"]),
    ).toBe("Thailand, Vietnam");
  });

  it("renders collapsed filter sections with compact summaries", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.getByText("No regions configured")).toBeTruthy();
    expect(screen.getAllByText("Off")).toHaveLength(3);
    expect(screen.getByText("3 visible countries")).toBeTruthy();
    expect(screen.queryByLabelText("Toggle Country")).toBeNull();
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
        countryCard={baseCountryCard}
        watchlistCard={{ ...baseWatchlistCard, enabled: true }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(
      screen.getByText("Christianity: GSEC <= 2"),
    ).toBeTruthy();
    expect(
      screen.getByText("Christianity: Frontier Group Y/N: True"),
    ).toBeTruthy();
    expect(screen.getByText("Under 5,000 -> at least 50 believers")).toBeTruthy();
    expect(screen.getByText("5,000-10,000 -> at least 75 believers")).toBeTruthy();
    expect(screen.getByText("Over 10,000 -> at least 100 believers")).toBeTruthy();
    expect(screen.getByText("Engage: 8 Phases of Engagement >= 6")).toBeTruthy();
  });

  it("shows Global, normalizes South Asia, and keeps region controls interactive", () => {
    const onSelectorChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={{
          supported: true,
          selectors: [
            {
              id: "globe",
              label: "Globe",
              checked: true,
              description: "",
              countries: ["Nepal"],
            },
            {
              id: "sea",
              label: "South East Asia",
              checked: true,
              description: "Countries across South East Asia.",
              countries: ["Thailand"],
            },
          ],
          onSelectorChange,
        }}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Region filters" }));

    expect(
      screen.getByText("A grouping of people groups based on geography."),
    ).toBeTruthy();
    expect(screen.getAllByText("Global")).toHaveLength(2);
    expect(screen.queryByText("Globe")).toBeNull();
    expect(screen.queryByText("South East Asia")).toBeNull();
    expect(screen.getByText("South Asia")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Toggle South Asia"));

    expect(onSelectorChange).toHaveBeenCalledWith("sea", false);
  });

  it("shows Global when the all-countries selector is active", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          ...baseRegionCard,
          selectors: [
            {
              id: "global",
              label: "Global",
              checked: true,
              description: "",
              countries: ["India", "Nepal"],
            },
            {
              id: "region-1",
              label: "South Asia",
              checked: false,
              description: "",
              countries: ["India"],
            },
          ],
        }}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    const regionSection = screen
      .getByRole("button", { name: "Region filters" })
      .closest("section");

    expect(regionSection).toBeTruthy();
    if (!regionSection) {
      throw new Error("Expected Region section to render");
    }
    expect(within(regionSection).getByText("Global")).toBeTruthy();
  });

  it("shows a selected count when only a subset of visible regions is active", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          ...baseRegionCard,
          selectors: [
            {
              id: "region-1",
              label: "South Asia",
              checked: true,
              description: "",
              countries: ["India"],
            },
            {
              id: "region-2",
              label: "Latin America",
              checked: false,
              description: "",
              countries: ["Brazil"],
            },
          ],
        }}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("shows a selected-country count when the country selection is narrowed", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={{
          ...baseCountryCard,
          selectedCountries: ["Jordan"],
          hasExplicitSelection: true,
        }}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.getByText("1 selected country")).toBeTruthy();
  });

  it("shows Off when no configured region is currently selected", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{
          ...baseRegionCard,
          selectors: [
            {
              id: "region-1",
              label: "South Asia",
              checked: false,
              description: "",
              countries: ["India"],
            },
          ],
        }}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.getAllByText("Off").length).toBeGreaterThanOrEqual(1);
  });

  it("preserves expanded section state across rerenders with stable props", () => {
    const regionCard = {
      ...baseRegionCard,
      selectors: [
        {
          id: "region-1",
          label: "South Asia",
          checked: false,
          description: "",
          countries: ["India"],
        },
      ],
    };
    const props = {
      regionCard,
      countryCard: baseCountryCard,
      watchlistCard: baseWatchlistCard,
      uupgCard: baseUupgCard,
      hotspotsCard: baseHotspotsCard,
    };
    const { rerender } = render(<DatasetViewSwitchGrid {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Region filters" }));
    expect(
      screen.getByText("A grouping of people groups based on geography."),
    ).toBeTruthy();

    rerender(<DatasetViewSwitchGrid {...props} />);

    expect(
      screen.getByText("A grouping of people groups based on geography."),
    ).toBeTruthy();
  });

  it("shows the simplified country description and in-card alternate-country toggle", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Country filters" }));

    expect(screen.getByText("Filter people groups by country.")).toBeTruthy();
    expect(screen.getByText("Alternate-country matching")).toBeTruthy();
    expect(screen.getByLabelText("Toggle Alternate-country matching")).toBeTruthy();
    expect(screen.queryByLabelText("Toggle Country")).toBeNull();
  });

  it("reveals watchlist descriptions and controls only when expanded", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          thresholdDefinition: "Global Status of Evangelical Christianity.",
          frontierGroupDefinition:
            "<.1% Christian Adherents and no confirmed sustained movement.",
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(
      screen.queryByLabelText("Christianity: GSEC"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const thresholdInput = screen.getByLabelText(
      "Christianity: GSEC",
    ) as HTMLInputElement;
    const thresholdLabel = screen.getByText("Christianity: GSEC");
    const frontierLabel = screen.getByText("Christianity: Frontier Group Y/N");
    const ruleLabel = screen.getByText("Population vs Evangelical Believers");
    const engagementLabel = screen.getByText("Engage: 8 Phases of Engagement");
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
      "Decrease Christianity: GSEC",
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
      thresholdLabel.compareDocumentPosition(frontierLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      frontierLabel.compareDocumentPosition(ruleLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      ruleLabel.compareDocumentPosition(engagementLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Configured rule")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Edit rule",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "Open the popup editor to adjust breakpoints, minimum believers, and the scenario test dot.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Engage: 8 Phases of Engagement")).toBeTruthy();
  });

  it("keeps country search interactive and auto-enables the filter on selection", () => {
    const onEnabledChange = vi.fn();
    const onIncludeAlternateCountriesChange = vi.fn();
    const onSearchChange = vi.fn();
    const onToggleCountry = vi.fn();
    const onSelectVisible = vi.fn();
    const onClearVisible = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={{
          enabled: false,
          supported: true,
          searchValue: "jor",
          availableCountries: ["Egypt", "Jordan", "Turkey"],
          visibleCountries: ["Egypt", "Jordan"],
          selectedCountries: [],
          includeAlternateCountries: false,
          supportsAlternateCountries: true,
          onEnabledChange,
          onIncludeAlternateCountriesChange,
          onSearchChange,
          onToggleCountry,
          onSelectVisible,
          onClearVisible,
        }}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Country filters" }));

    expect(screen.getByText("2 visible countries")).toBeTruthy();
    expect(screen.queryByText("2 visible")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear visible" })).toBeNull();

    const searchInput = screen.getByLabelText("Search countries");

    expect(searchInput.getAttribute("disabled")).toBeNull();

    fireEvent.change(searchInput, { target: { value: "eg" } });
    fireEvent.click(
      screen.getByLabelText("Toggle Alternate-country matching"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByLabelText("Include Jordan"));

    expect(screen.queryByText("Egypt")).toBeNull();
    expect(screen.getByText("Jordan")).toBeTruthy();
    expect(onSearchChange).toHaveBeenCalledWith("eg");
    expect(onIncludeAlternateCountriesChange.mock.calls[0]?.[0]).toBe(true);
    expect(onSelectVisible).toHaveBeenCalledWith(["Egypt", "Jordan", "Turkey"]);
    expect(onClearVisible).not.toHaveBeenCalled();
    expect(onToggleCountry).toHaveBeenCalledWith("Jordan", true);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("hides the alternate-country toggle when the dataset does not support it", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={{
          ...baseCountryCard,
          supportsAlternateCountries: false,
        }}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Country filters" }));

    expect(
      screen.queryByLabelText("Toggle Alternate-country matching"),
    ).toBeNull();
  });

  it("keeps the watchlist segmented control interactive when the section is expanded", () => {
    const onFrontierGroupValueChange = vi.fn();
    const onThresholdEnabledChange = vi.fn();
    const onFrontierGroupEnabledChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          onThresholdEnabledChange,
          onFrontierGroupEnabledChange,
          onFrontierGroupValueChange,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
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
    const thresholdToggle = screen.getByLabelText(
      "Toggle Watchlist Christianity: GSEC",
    );
    const frontierToggle = screen.getByLabelText(
      "Toggle Watchlist Christianity: Frontier Group Y/N",
    );

    expect(
      frontierLabel.compareDocumentPosition(frontierInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("=")).toBeNull();

    fireEvent.click(thresholdToggle);
    fireEvent.click(frontierToggle);
    fireEvent.click(falseButton);

    expect(onThresholdEnabledChange.mock.calls[0]?.[0]).toBe(false);
    expect(onFrontierGroupEnabledChange.mock.calls[0]?.[0]).toBe(false);
    expect(onFrontierGroupValueChange).toHaveBeenCalledWith(false);
  });

  it("opens the population-believers editor in a dialog and closes it with Done", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{ ...baseWatchlistCard, enabled: true }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));

    expect(
      screen.getByRole("dialog", { name: "Population vs Evangelical Believers" }),
    ).toBeTruthy();
    expect(screen.getByText("Scenario result")).toBeTruthy();
    expect(screen.getByText("Test scenario")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(
      screen.queryByRole("dialog", {
        name: "Population vs Evangelical Believers",
      }),
    ).toBeNull();
  });

  it("closes the population-believers editor with Escape", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{ ...baseWatchlistCard, enabled: true }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));

    expect(
      screen.getByRole("dialog", { name: "Population vs Evangelical Believers" }),
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", {
        name: "Population vs Evangelical Believers",
      }),
    ).toBeNull();
  });

  it("shows only the first three inline rule lines and a remainder count", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          populationBelieversRule: {
            tiers: [
              { minPopulation: 0, maxPopulation: 999, minBelievers: 10 },
              { minPopulation: 1_000, maxPopulation: 4_999, minBelievers: 25 },
              { minPopulation: 5_000, maxPopulation: 9_999, minBelievers: 50 },
              { minPopulation: 10_000, maxPopulation: null, minBelievers: 75 },
            ],
          },
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const configuredRuleCard = screen.getByText("Configured rule").closest("div");

    expect(configuredRuleCard).toBeTruthy();
    if (!configuredRuleCard) {
      throw new Error("Expected configured rule card to render");
    }

    expect(
      within(configuredRuleCard).getByText("Under 1,000 -> at least 10 believers"),
    ).toBeTruthy();
    expect(
      within(configuredRuleCard).getByText("1,000-4,999 -> at least 25 believers"),
    ).toBeTruthy();
    expect(
      within(configuredRuleCard).getByText("5,000-9,999 -> at least 50 believers"),
    ).toBeTruthy();
    expect(within(configuredRuleCard).getByText("+1 more tiers")).toBeTruthy();
  });

  it("reveals the UUPG field metadata when expanded while keeping the toggle in the section header", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          fieldLabel: "Engage: Global Engagement Anywhere? (Y/N)",
          fieldDefinition: "Tracks whether engagement exists anywhere.",
        }}
        hotspotsCard={baseHotspotsCard}
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

  it("summarizes and edits hotspots controls when the section is enabled", () => {
    const onMetricChange = vi.fn();
    const onCountryCountChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={{
          ...baseHotspotsCard,
          enabled: true,
          metric: "population",
          countryCount: 10,
          onMetricChange,
          onCountryCountChange,
        }}
      />,
    );

    expect(screen.getByText("Top 10 countries by UUPG population")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hotspots filters" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Set Hotspots ranking to Unique UUPGs" }),
    );
    fireEvent.change(screen.getByLabelText("Hotspots country count"), {
      target: { value: "12" },
    });

    expect(onMetricChange).toHaveBeenCalledWith("unique_uupgs");
    expect(onCountryCountChange).toHaveBeenCalledWith(12);
  });

  it("shows unavailable summaries for unsupported filters", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={{ ...baseRegionCard, supported: false }}
        countryCard={{ ...baseCountryCard, supported: false }}
        watchlistCard={{ ...baseWatchlistCard, supported: false }}
        uupgCard={{ ...baseUupgCard, supported: false }}
        hotspotsCard={{ ...baseHotspotsCard, supported: false }}
      />,
    );

    expect(screen.getAllByText("Unavailable")).toHaveLength(5);
  });

  it("applies custom classes to the root panel", () => {
    const { container } = render(
      <DatasetViewSwitchGrid
        className="border-0 shadow-none"
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    const root = container.firstElementChild as HTMLDivElement | null;

    expect(root).toBeTruthy();
    expect(root?.className).toContain("border-0");
    expect(root?.className).toContain("shadow-none");
  });
});
