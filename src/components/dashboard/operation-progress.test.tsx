// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OperationProgress, formatElapsed } from "./operation-progress";

describe("OperationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T18:00:10.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders truthful determinate progress", () => {
    render(
      <OperationProgress
        title="Dataset upload"
        phase="Saving rows"
        detail="500 rows"
        value={65}
      />,
    );

    expect(screen.getByText("65%")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Dataset upload" })).toBeTruthy();
    expect(document.querySelector('[data-operation-progress="determinate"]')).toBeTruthy();
    expect(screen.getByText("Saving rows")).toBeTruthy();
  });

  it("renders indeterminate activity and advances only the visual elapsed clock", () => {
    render(
      <OperationProgress
        title="Connection test"
        phase="Testing source"
        startedAt="2026-08-17T18:00:00.000Z"
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Connection test" });
    expect(progress.getAttribute("aria-valuenow")).toBeNull();
    expect(progress.getAttribute("aria-valuetext")).toBe("Testing source");
    expect(screen.getByText("Elapsed 10s").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByText(/%/)).toBeNull();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("Elapsed 12s")).toBeTruthy();
    expect(screen.getByRole("status").textContent).not.toContain("12s");
  });

  it("shows freshness warning and recovery without changing the phase", () => {
    const { rerender } = render(
      <OperationProgress
        title="Dataset ingestion"
        phase="Ingesting source data"
        startedAt="2026-08-17T18:00:00.000Z"
        freshnessUnavailable
      />,
    );

    expect(screen.getAllByText(/Current status cannot be confirmed/).length).toBeGreaterThan(0);
    expect(screen.getByText("Ingesting source data")).toBeTruthy();

    rerender(
      <OperationProgress
        title="Dataset ingestion"
        phase="Ingesting source data"
        startedAt="2026-08-17T18:00:00.000Z"
        lastCheckedAt={Date.now()}
      />,
    );
    expect(screen.getByText("Status checked just now.")).toBeTruthy();
    expect(screen.queryByText(/Current status cannot be confirmed/)).toBeNull();
  });

  it("retains explicit text without depending on animation and disappears when inactive", () => {
    const { rerender } = render(
      <OperationProgress title="Connection test" phase="Waiting to test" />,
    );
    expect(screen.getByText("Waiting to test")).toBeTruthy();
    expect(document.querySelector(".motion-reduce\\:hidden")).toBeTruthy();

    rerender(
      <OperationProgress title="Connection test" phase="Waiting to test" active={false} />,
    );
    expect(screen.queryByText("Waiting to test")).toBeNull();
  });

  it("formats long elapsed durations", () => {
    expect(formatElapsed(5000)).toBe("5s");
    expect(formatElapsed(65_000)).toBe("1m 5s");
    expect(formatElapsed(3_665_000)).toBe("1h 1m 5s");
  });
});
