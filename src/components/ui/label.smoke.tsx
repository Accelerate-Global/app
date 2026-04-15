"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function LabelSmokeFixture() {
  return (
    <div className="space-y-2">
      <Label htmlFor="smoke-label-input">Fixture label</Label>
      <Input id="smoke-label-input" defaultValue="Labeled input" />
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "label",
  title: "Label",
  description: "Form label pairing.",
  Component: LabelSmokeFixture,
});
