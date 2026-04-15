"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function CheckboxSmokeFixture() {
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <Checkbox defaultChecked aria-label="Shared checkbox fixture" />
      Include this shared control in the smoke page.
    </label>
  );
}

export default defineUiSmokeFixture({
  id: "checkbox",
  title: "Checkbox",
  description: "Boolean selection control.",
  Component: CheckboxSmokeFixture,
});
