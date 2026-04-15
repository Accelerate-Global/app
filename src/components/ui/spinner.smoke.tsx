"use client";

import { Spinner } from "@/components/ui/spinner";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SpinnerSmokeFixture() {
  return <Spinner className="size-5 text-foreground" />;
}

export default defineUiSmokeFixture({
  id: "spinner",
  title: "Spinner",
  description: "Indeterminate loading spinner.",
  Component: SpinnerSmokeFixture,
});
