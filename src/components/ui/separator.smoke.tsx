"use client";

import { Separator } from "@/components/ui/separator";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SeparatorSmokeFixture() {
  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground">Section one</div>
      <Separator />
      <div className="text-sm text-foreground">Section two</div>
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "separator",
  title: "Separator",
  description: "Section dividers and tool separators.",
  Component: SeparatorSmokeFixture,
});
