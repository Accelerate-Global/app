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
          onEnabledChange: vi.fn(),
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
});
