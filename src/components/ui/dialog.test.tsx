// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Dialog, DialogContent, DialogTitle } from "./dialog"

describe("DialogContent", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders as a centered modal with a higher z-index than sheets", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit rule</DialogTitle>
          <div>Dialog body</div>
        </DialogContent>
      </Dialog>,
    )

    const dialog = screen.getByRole("dialog", { name: "Edit rule" })

    expect(dialog.className).toContain("top-1/2")
    expect(dialog.className).toContain("left-1/2")
    expect(dialog.className).toContain("z-[70]")
    expect(dialog.style.touchAction).toBe("pan-y")
  })

  it("renders the shared close button inside the dialog chrome", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit rule</DialogTitle>
          <div>Dialog body</div>
        </DialogContent>
      </Dialog>,
    )

    const closeButton = screen.getByRole("button", { name: "Close" })

    expect(closeButton.className).toContain("top-4")
    expect(closeButton.className).toContain("right-4")
    expect(closeButton.className).toContain("rounded-full")
    expect(closeButton.className).toContain("border-border/70")
  })
})
