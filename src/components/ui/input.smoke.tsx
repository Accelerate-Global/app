"use client";

import { Input } from "@/components/ui/input";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function InputSmokeFixture() {
  return <Input defaultValue="Smoke input value" aria-label="Smoke input fixture" />;
}

export default defineUiSmokeFixture({
  id: "input",
  title: "Input",
  description: "Single-line text field.",
  Component: InputSmokeFixture,
});
