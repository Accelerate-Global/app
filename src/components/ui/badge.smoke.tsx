"use client";

import { Badge } from "@/components/ui/badge";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function BadgeSmokeFixture() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Shared</Badge>
      <Badge variant="secondary">Viewer</Badge>
      <Badge variant="outline">Filter</Badge>
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "badge",
  title: "Badge",
  description: "Compact status and category labels.",
  Component: BadgeSmokeFixture,
});
