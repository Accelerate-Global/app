"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SelectSmokeFixture() {
  return (
    <Select defaultValue="shared">
      <SelectTrigger
        className="w-48"
        data-smoke-trigger="fixture-select"
        aria-label="Smoke select fixture"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        data-smoke-surface="fixture-select"
        data-smoke-ready="fixture-select"
      >
        <SelectGroup>
          <SelectLabel>Fixtures</SelectLabel>
          <SelectItem value="shared">Shared</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default defineUiSmokeFixture({
  id: "select",
  title: "Select",
  description: "Shared listbox and trigger primitive.",
  Component: SelectSmokeFixture,
});
