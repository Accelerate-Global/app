// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DatasetViewSwitchGrid,
  getRegionTooltipText,
} from "./dataset-view-switch-grid";

const defaultJpOnlyEvangelicalRule = {
  minBelievers: 75,
  maxBelievers: 249_999,
  maxPercentEvangelical: 2,
};

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
  thresholdDefinition: "GSEC definition",
  thresholdEnabled: true,
  threshold: 2,
  thresholdIsDefault: true,
  jpOnlyEvangelicalCriteriaEnabled: true,
  jpOnlyEvangelicalCriteriaSupported: true,
  jpOnlyEvangelicalCriteriaLabel: "Evangelical Believers (JP-only)",
  jpOnlyEvangelicalCriteriaDefinition:
    "Applies only to JP-only rows (JP_Source = true; IMB_Source = false; AX_Source = false; ETNO_Source = false; WCD_Source = false) and keeps rows with under 75 evangelical believers regardless of evangelical percent, plus rows with 75-249,999 evangelical believers and <= 2% evangelical.",
  jpOnlyEvangelicalCriteriaSummary:
    "JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical",
  jpOnlyEvangelicalRule: defaultJpOnlyEvangelicalRule,
  jpOnlyEvangelicalRuleIsDefault: true,
  engagementPhaseEnabled: true,
  engagementPhaseLabel: "Engage: 8 Phases of Engagement",
  engagementPhaseDefinition:
    "Engagement phase definition\n\nWhen enabled, Watchlist keeps only AX rows with values 2-5. If AX_Source is missing or invalid, Watchlist treats the row as AX and still applies the 2-5 rule.",
  engagementPhaseRule: {
    minPhase: 2,
    maxPhase: 5,
  },
  engagementPhaseRuleIsDefault: true,
  engagementPhaseSummary: "Engage: 8 Phases of Engagement 2-5 only",
  onEnabledChange: vi.fn(),
  onThresholdEnabledChange: vi.fn(),
  onThresholdChange: vi.fn(),
  onThresholdReset: vi.fn(),
  onEngagementPhaseEnabledChange: vi.fn(),
  onEngagementPhaseRuleChange: vi.fn(),
  onEngagementPhaseRuleReset: vi.fn(),
  onJpOnlyEvangelicalCriteriaEnabledChange: vi.fn(),
  onJpOnlyEvangelicalRuleChange: vi.fn(),
  onJpOnlyEvangelicalRuleReset: vi.fn(),
};

const baseUupgCard = {
  enabled: false,
  supported: true,
  globalEngagementAnywhereLabel: "Global Engagement Anywhere",
  globalEngagementAnywhereDefinition: "UUPG definition",
  globalEngagementAnywhereEnabled: true,
  frontierGroupSupported: true,
  frontierGroupLabel: "Christianity: Frontier Group Y/N",
  frontierGroupDefinition: "Frontier definition",
  frontierGroupEnabled: true,
  onEnabledChange: vi.fn(),
  onGlobalEngagementAnywhereEnabledChange: vi.fn(),
  onFrontierGroupEnabledChange: vi.fn(),
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
      screen.getByText("GSEC (IMB-only) <= 2"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Engage: 8 Phases of Engagement 2-5 only")).toBeTruthy();
    expect(screen.queryByText(/Frontier Group/)).toBeNull();
    expect(
      screen.queryByText("Population vs Evangelical Believers"),
    ).toBeNull();
  });

  it("omits the phases-of-engagement summary when that toggle is off", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          engagementPhaseEnabled: false,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(
      screen.queryByText("Engage: 8 Phases of Engagement 2-5 only"),
    ).toBeNull();
  });

  it("shows canonical region labels and keeps region controls interactive", () => {
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
    expect(screen.getByText("Asia, Southeast")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Toggle Asia, Southeast"));

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
              label: "Asia, South",
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
              label: "Asia, South",
              checked: true,
              description: "",
              countries: ["India"],
            },
            {
              id: "region-2",
              label: "America, Latin",
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
              label: "Asia, South",
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
          label: "Asia, South",
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

  it("reveals watchlist descriptions and exposes an engagement-phase toggle", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          thresholdDefinition: "Global Status of Evangelical Christianity.",
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.queryByText("Warning")).toBeNull();
    expect(
      screen.queryByText("Watchlist is not working correctly yet"),
    ).toBeNull();
    expect(
      screen.queryByLabelText("GSEC (IMB-only)"),
    ).toBeNull();
    expect(
      screen.queryByText("Keep only AX rows with values 2-5."),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const thresholdLabel = screen.getByText("GSEC (IMB-only)");
    const jpOnlyLabel = screen.getByText("Evangelical Believers (JP-only)");
    const engagementLabel = screen.getByText("Engage: 8 Phases of Engagement");
    const thresholdInfo = screen.getByLabelText(
      "View definition for GSEC (IMB-only)",
    );

    expect(
      screen.getByText(
        "People groups unengaged or would be unengaged if the current mission work stopped today.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("Watchlist is not working correctly yet"),
    ).toBeNull();
    expect(
      screen.queryByText(
        "These filters can return incorrect results while the Watchlist logic is being fixed. Do not rely on this section yet.",
      ),
    ).toBeNull();
    expect(screen.queryByText("<= 2")).toBeNull();
    expect(screen.queryByText("Keep through")).toBeNull();
    expect(screen.queryByText("Keep from")).toBeNull();
    expect(screen.queryByText("Auto-keep below")).toBeNull();
    expect(screen.queryByText("Percent cap through")).toBeNull();
    expect(screen.queryByLabelText("GSEC (IMB-only)")).toBeNull();
    expect(screen.queryByLabelText("Decrease GSEC (IMB-only)")).toBeNull();
    expect(screen.getByText("Keep below")).toBeTruthy();
    expect(screen.getByText("Max population")).toBeTruthy();
    expect(screen.getByText("Phase range")).toBeTruthy();
    expect(
      thresholdLabel.compareDocumentPosition(thresholdInfo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thresholdLabel.compareDocumentPosition(engagementLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      thresholdLabel.compareDocumentPosition(jpOnlyLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      jpOnlyLabel.compareDocumentPosition(engagementLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Christianity: Frontier Group Y/N")).toBeNull();
    expect(
      screen.queryByText("Population vs Evangelical Believers"),
    ).toBeNull();
    expect(screen.queryByText("Keep only AX rows with values 2-5.")).toBeNull();
    expect(
      screen.queryByLabelText("Engage: 8 Phases of Engagement"),
    ).toBeNull();
    expect(
      screen.getByLabelText(
        "Toggle Watchlist Engage: 8 Phases of Engagement",
      ),
    ).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeTruthy();

    const searchInput = screen.getByLabelText("Search countries");

    expect(searchInput.getAttribute("disabled")).toBeNull();

    fireEvent.change(searchInput, { target: { value: "eg" } });
    fireEvent.click(
      screen.getByLabelText("Toggle Alternate-country matching"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    fireEvent.click(screen.getByLabelText("Include Jordan"));

    expect(screen.queryByText("Egypt")).toBeNull();
    expect(screen.getByText("Jordan")).toBeTruthy();
    expect(onSearchChange).toHaveBeenCalledWith("eg");
    expect(onIncludeAlternateCountriesChange.mock.calls[0]?.[0]).toBe(true);
    expect(onSelectVisible).toHaveBeenCalledWith(["Egypt", "Jordan", "Turkey"]);
    expect(onClearVisible).toHaveBeenCalledWith([
      "Egypt",
      "Jordan",
      "Turkey",
    ]);
    expect(onToggleCountry).toHaveBeenCalledWith("Jordan", true);
    expect(onEnabledChange).toHaveBeenCalledTimes(3);
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

  it("keeps the watchlist threshold toggle interactive and omits the legacy frontier row", () => {
    const onThresholdEnabledChange = vi.fn();
    const onEngagementPhaseEnabledChange = vi.fn();
    const onJpOnlyEvangelicalCriteriaEnabledChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          onThresholdEnabledChange,
          onEngagementPhaseEnabledChange,
          onJpOnlyEvangelicalCriteriaEnabledChange,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    const thresholdToggle = screen.getByLabelText(
      "Toggle Watchlist GSEC (IMB-only)",
    );
    const engagementPhaseToggle = screen.getByLabelText(
      "Toggle Watchlist Engage: 8 Phases of Engagement",
    );
    const jpOnlyToggle = screen.getByLabelText(
      "Toggle Watchlist Evangelical Believers (JP-only)",
    );

    fireEvent.click(thresholdToggle);
    fireEvent.click(engagementPhaseToggle);
    fireEvent.click(jpOnlyToggle);

    expect(onThresholdEnabledChange.mock.calls[0]?.[0]).toBe(false);
    expect(onEngagementPhaseEnabledChange.mock.calls[0]?.[0]).toBe(false);
    expect(onJpOnlyEvangelicalCriteriaEnabledChange.mock.calls[0]?.[0]).toBe(
      false,
    );
    expect(screen.queryByText("Christianity: Frontier Group Y/N")).toBeNull();
  });

  it("lets users edit the JP-only rule inline and reset it to defaults", () => {
    const onJpOnlyEvangelicalRuleChange = vi.fn();
    const onJpOnlyEvangelicalRuleReset = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          jpOnlyEvangelicalRule: {
            minBelievers: 80,
            maxBelievers: 300_000,
            maxPercentEvangelical: 2.5,
          },
          jpOnlyEvangelicalRuleIsDefault: false,
          jpOnlyEvangelicalCriteriaSummary:
            "JP-only: < 80 believers, or 80-300,000 believers and <= 2.5% evangelical",
          onJpOnlyEvangelicalRuleChange,
          onJpOnlyEvangelicalRuleReset,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));
    fireEvent.change(screen.getByLabelText("JP-only believer floor"), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByLabelText("JP-only believer ceiling"), {
      target: { value: "320000" },
    });
    fireEvent.change(screen.getByLabelText("JP-only max evangelical percent"), {
      target: { value: "3.25" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Reset defaults" })[1]!);

    expect(onJpOnlyEvangelicalRuleChange).toHaveBeenNthCalledWith(1, {
      minBelievers: 90,
      maxBelievers: 300_000,
      maxPercentEvangelical: 2.5,
    });
    expect(onJpOnlyEvangelicalRuleChange).toHaveBeenNthCalledWith(2, {
      minBelievers: 80,
      maxBelievers: 320_000,
      maxPercentEvangelical: 2.5,
    });
    expect(onJpOnlyEvangelicalRuleChange).toHaveBeenNthCalledWith(3, {
      minBelievers: 80,
      maxBelievers: 300_000,
      maxPercentEvangelical: 3.25,
    });
    expect(onJpOnlyEvangelicalRuleReset).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByText(
        "JP-only: < 80 believers, or 80-300,000 believers and <= 2.5% evangelical",
      ),
    ).toHaveLength(1);
  });

  it("lets users edit the GSEC and engagement-phase rules inline and reset them", () => {
    const onThresholdChange = vi.fn();
    const onThresholdReset = vi.fn();
    const onEngagementPhaseRuleChange = vi.fn();
    const onEngagementPhaseRuleReset = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          threshold: 4,
          thresholdIsDefault: false,
          engagementPhaseRule: {
            minPhase: 1,
            maxPhase: 4,
          },
          engagementPhaseRuleIsDefault: false,
          engagementPhaseDefinition:
            "Engagement phase definition\n\nWhen enabled, Watchlist keeps only AX rows with values 1-4. If AX_Source is missing or invalid, Watchlist treats the row as AX and still applies the 1-4 rule.",
          engagementPhaseSummary: "Engage: 8 Phases of Engagement 1-4 only",
          onThresholdChange,
          onThresholdReset,
          onEngagementPhaseRuleChange,
          onEngagementPhaseRuleReset,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));
    fireEvent.change(screen.getByLabelText("Watchlist GSEC max"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Watchlist engagement min phase"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Watchlist engagement max phase"), {
      target: { value: "6" },
    });

    const resetButtons = screen.getAllByRole("button", { name: "Reset defaults" });

    fireEvent.click(resetButtons[0]!);
    fireEvent.click(resetButtons[2]!);

    expect(onThresholdChange).toHaveBeenCalledWith(5);
    expect(onEngagementPhaseRuleChange).toHaveBeenNthCalledWith(1, {
      minPhase: 2,
      maxPhase: 4,
    });
    expect(onEngagementPhaseRuleChange).toHaveBeenNthCalledWith(2, {
      minPhase: 1,
      maxPhase: 6,
    });
    expect(onThresholdReset).toHaveBeenCalledTimes(1);
    expect(onEngagementPhaseRuleReset).toHaveBeenCalledTimes(1);
  });

  it("stacks the engagement phase range controls and keeps the values visible", () => {
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

    const phaseRangeControls = screen.getByText("Phase range").nextElementSibling;
    const minPhaseInput = screen.getByLabelText(
      "Watchlist engagement min phase",
    ) as HTMLInputElement;
    const maxPhaseInput = screen.getByLabelText(
      "Watchlist engagement max phase",
    ) as HTMLInputElement;

    expect(phaseRangeControls?.className).toContain("flex-col");
    expect(phaseRangeControls?.className).not.toContain("sm:flex-row");
    expect(minPhaseInput.value).toBe("2");
    expect(maxPhaseInput.value).toBe("5");
    expect(minPhaseInput.style.webkitTextFillColor).toBe("currentcolor");
    expect(maxPhaseInput.style.webkitTextFillColor).toBe("currentcolor");
  });

  it("uses an auto-fit layout for the JP-only rule controls", () => {
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

    const jpOnlyRuleGrid = screen.getByText("Keep below").parentElement?.parentElement;

    expect(jpOnlyRuleGrid?.className).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]",
    );
    expect(jpOnlyRuleGrid?.className).not.toContain("lg:grid-cols-3");
  });

  it("disables the JP-only rule inputs when the criterion is off", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          jpOnlyEvangelicalCriteriaEnabled: false,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    expect(
      screen.getByLabelText("JP-only believer floor").getAttribute("disabled"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText("JP-only believer ceiling").getAttribute("disabled"),
    ).not.toBeNull();
    expect(
      screen
        .getByLabelText("JP-only max evangelical percent")
        .getAttribute("disabled"),
    ).not.toBeNull();
  });

  it("hides the JP-only row when the dataset does not expose the source flags", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={{
          ...baseWatchlistCard,
          enabled: true,
          jpOnlyEvangelicalCriteriaSupported: false,
        }}
        uupgCard={baseUupgCard}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watchlist filters" }));

    expect(screen.queryByText("Evangelical Believers (JP-only)")).toBeNull();
    expect(
      screen.queryByText(
        "JP-only: < 75 believers, or 75-249,999 believers and <= 2% evangelical",
      ),
    ).toBeNull();
  });

  it("reveals the UUPG criteria when expanded while keeping the master toggle in the section header", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          globalEngagementAnywhereLabel:
            "Engage: Global Engagement Anywhere? (Y/N)",
          globalEngagementAnywhereDefinition:
            "Tracks whether engagement exists anywhere.",
          frontierGroupLabel: "Christianity: Frontier Group Y/N",
          frontierGroupDefinition:
            "Tracks whether the group is classified as frontier.",
        }}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    expect(screen.getByLabelText("Toggle UUPG")).toBeTruthy();
    expect(
      screen.queryByLabelText(
        "View definition for Engage: Global Engagement Anywhere? (Y/N)",
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "UUPG filters" }));

    expect(
      screen.getAllByText("Engage: Global Engagement Anywhere? (Y/N)"),
    ).toHaveLength(2);
    expect(
      screen.getByLabelText(
        "View definition for Engage: Global Engagement Anywhere? (Y/N)",
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Christianity: Frontier Group Y/N"),
    ).toHaveLength(2);
    expect(
      screen.getByLabelText(
        "View definition for Christianity: Frontier Group Y/N",
      ),
    ).toBeTruthy();
  });

  it("exposes separate UUPG child toggles when expanded", () => {
    const onGlobalEngagementAnywhereEnabledChange = vi.fn();
    const onFrontierGroupEnabledChange = vi.fn();

    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          onGlobalEngagementAnywhereEnabledChange,
          onFrontierGroupEnabledChange,
        }}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "UUPG filters" }));
    fireEvent.click(
      screen.getByLabelText("Toggle UUPG Global Engagement Anywhere"),
    );
    fireEvent.click(
      screen.getByLabelText("Toggle UUPG Christianity: Frontier Group Y/N"),
    );

    expect(onGlobalEngagementAnywhereEnabledChange).toHaveBeenCalledWith(
      false,
      expect.anything(),
    );
    expect(onFrontierGroupEnabledChange).toHaveBeenCalledWith(
      false,
      expect.anything(),
    );
  });

  it("disables the last active UUPG child toggle while the master toggle remains on", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          frontierGroupEnabled: false,
        }}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "UUPG filters" }));

    expect(
      screen
        .getByLabelText("Toggle UUPG Global Engagement Anywhere")
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      screen
        .getByLabelText("Toggle UUPG Christianity: Frontier Group Y/N")
        .hasAttribute("data-disabled"),
    ).toBe(false);
  });

  it("omits the frontier UUPG row when the dataset does not support it", () => {
    render(
      <DatasetViewSwitchGrid
        regionCard={baseRegionCard}
        countryCard={baseCountryCard}
        watchlistCard={baseWatchlistCard}
        uupgCard={{
          ...baseUupgCard,
          enabled: true,
          frontierGroupSupported: false,
        }}
        hotspotsCard={baseHotspotsCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "UUPG filters" }));

    expect(screen.getAllByText("Global Engagement Anywhere")).toHaveLength(2);
    expect(screen.queryByText("Christianity: Frontier Group Y/N")).toBeNull();
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
