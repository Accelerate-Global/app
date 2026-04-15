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
});
