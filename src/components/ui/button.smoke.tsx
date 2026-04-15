"use client";

import { Button } from "@/components/ui/button";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function ButtonSmokeFixture() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button">Primary</Button>
      <Button type="button" variant="outline">
        Secondary
      </Button>
      <Button type="button" variant="ghost" size="sm">
        Tertiary
      </Button>
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "button",
  title: "Button",
  description: "Primary and secondary action buttons.",
  Component: ButtonSmokeFixture,
});
