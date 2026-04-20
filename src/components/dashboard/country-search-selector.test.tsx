// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CountrySearchSelector } from "./country-search-selector";

describe("CountrySearchSelector", () => {
  it("renders a compact searchable selector and forwards actions", () => {
    const onSearchChange = vi.fn();
    const onToggleCountry = vi.fn();
    const onSelectVisible = vi.fn();
    const onClearVisible = vi.fn();

    render(
      <CountrySearchSelector
        allCountries={["Egypt", "Jordan", "Turkey"]}
        selectedCountries={["Jordan"]}
        searchValue="jor"
        disabled={false}
        onSearchChange={onSearchChange}
        onToggleCountry={onToggleCountry}
        onSelectVisible={onSelectVisible}
        onClearVisible={onClearVisible}
      />,
    );

    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByLabelText("Search countries")).toBeTruthy();
    expect(screen.queryByText("Showing 1 of 3")).toBeNull();
    expect(screen.queryByText("Search the list, then select individual countries or apply the visible results.")).toBeNull();
    expect(screen.queryByText("Search countries")).toBeNull();
    expect(screen.queryByText("Egypt")).toBeNull();
    expect(screen.getByText("Jordan")).toBeTruthy();
    expect(screen.getByText("Selected")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search countries"), {
      target: { value: "eg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear visible" }));
    fireEvent.click(screen.getByLabelText("Include Jordan"));

    expect(onSearchChange).toHaveBeenCalledWith("eg");
    expect(onSelectVisible).toHaveBeenCalledWith(["Jordan"]);
    expect(onClearVisible).toHaveBeenCalledWith(["Jordan"]);
    expect(onToggleCountry).toHaveBeenCalledWith("Jordan", false);
  });

  it("renders an empty state when the search has no matches", () => {
    render(
      <CountrySearchSelector
        allCountries={["Egypt", "Jordan", "Turkey"]}
        selectedCountries={[]}
        searchValue="zzz"
        disabled={false}
        onSearchChange={vi.fn()}
        onToggleCountry={vi.fn()}
        onSelectVisible={vi.fn()}
        onClearVisible={vi.fn()}
      />,
    );

    expect(screen.getByText("No countries match this search.")).toBeTruthy();
  });

  it("shows the active-country count when the current result set is broader than the explicit selection", () => {
    render(
      <CountrySearchSelector
        allCountries={["Egypt", "Jordan", "Turkey"]}
        selectedCountries={[]}
        visibleCountries={["Egypt", "Jordan"]}
        searchValue=""
        disabled={false}
        onSearchChange={vi.fn()}
        onToggleCountry={vi.fn()}
        onSelectVisible={vi.fn()}
        onClearVisible={vi.fn()}
      />,
    );

    expect(screen.getByText("2 visible")).toBeTruthy();
  });
});
