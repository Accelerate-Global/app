// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GoogleSheetsHeaderSelection } from "./google-sheets-header-selection";

const preview = {
  sheetId: 1,
  sheetTitle: "Engagement Data",
  inspectedRowCount: 6,
  candidates: [
    {
      rowNumber: 2,
      score: 6.4,
      confidence: "medium" as const,
      values: ["Identity", "Engagement"],
    },
    {
      rowNumber: 3,
      score: 8.8,
      confidence: "high" as const,
      values: ["People Group", "Country"],
    },
  ],
  recommendedRow: 3,
  selected: {
    mode: "auto" as const,
    startRow: 3,
    endRow: 3,
    headers: ["People Group", "Country"],
    fingerprint: "fingerprint",
    confidence: "high" as const,
  },
  sampleRows: [["Khmu", "Laos"]],
};

describe("GoogleSheetsHeaderSelection", () => {
  it("exposes the smoke surface and previews exact columns and sample rows", () => {
    render(
      <GoogleSheetsHeaderSelection
        preview={preview}
        selection={{ sheetId: 1, mode: "auto", startRow: 3, endRow: 3 }}
        onChange={vi.fn()}
      />,
    );

    const surface = document.querySelector(
      '[data-smoke-surface="google-sheets-header-selection"]',
    );
    expect(surface?.getAttribute("data-smoke-ready")).toBe(
      "google-sheets-header-selection",
    );
    expect(screen.getByText("People Group")).toBeTruthy();
    expect(screen.getByText("Khmu")).toBeTruthy();
  });

  it("marks row overrides and multi-row composition as manual", () => {
    const onChange = vi.fn();
    render(
      <GoogleSheetsHeaderSelection
        preview={preview}
        selection={{ sheetId: 1, mode: "auto", startRow: 3, endRow: 3 }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Header row for Engagement Data"), {
      target: { value: "2" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      sheetId: 1,
      mode: "manual",
      startRow: 2,
      endRow: 2,
    });

    fireEvent.change(
      screen.getByLabelText("Header rows to combine for Engagement Data"),
      { target: { value: "2" } },
    );
    expect(onChange).toHaveBeenLastCalledWith({
      sheetId: 1,
      mode: "manual",
      startRow: 3,
      endRow: 4,
    });
  });
});
