// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Sheet, SheetContent, SheetTitle } from "./sheet";

describe("SheetContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with the shared no-drag touch policy for side sheets", () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Edit dataset</SheetTitle>
          <div>Sheet body</div>
        </SheetContent>
      </Sheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit dataset" });

    expect(dialog.className).toContain("overflow-hidden");
    expect(dialog.style.touchAction).toBe("pan-y");
  });

  it("renders the shared close button inset inside the sheet chrome", () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Edit dataset</SheetTitle>
          <div>Sheet body</div>
        </SheetContent>
      </Sheet>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });

    expect(closeButton.className).toContain("top-4");
    expect(closeButton.className).toContain("right-4");
    expect(closeButton.className).toContain("rounded-full");
    expect(closeButton.className).toContain("border-border/70");
  });
});
