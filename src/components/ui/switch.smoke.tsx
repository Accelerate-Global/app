"use client";

import { Switch } from "@/components/ui/switch";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SwitchSmokeFixture() {
  return (
    <label className="flex items-center gap-3 text-sm text-foreground">
      <Switch defaultChecked aria-label="Shared switch fixture" />
      Enable the smoke switch fixture.
    </label>
  );
}

export default defineUiSmokeFixture({
  id: "switch",
  title: "Switch",
  description: "Boolean toggle primitive.",
  Component: SwitchSmokeFixture,
});
