"use client";

import { Toggle } from "@/components/ui/toggle";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function ToggleSmokeFixture() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Toggle first option" defaultPressed>
        First
      </Toggle>
      <Toggle aria-label="Toggle second option" variant="outline">
        Second
      </Toggle>
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "toggle",
  title: "Toggle",
  description: "Pressed and unpressed toggle buttons.",
  Component: ToggleSmokeFixture,
});
