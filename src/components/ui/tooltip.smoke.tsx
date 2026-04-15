"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function TooltipSmokeFixture() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-smoke-trigger="fixture-tooltip"
          />
        }
      >
        Hover me
      </TooltipTrigger>
      <TooltipContent
        data-smoke-surface="fixture-tooltip"
        data-smoke-ready="fixture-tooltip"
      >
        Fixture tooltip content
      </TooltipContent>
    </Tooltip>
  );
}

export default defineUiSmokeFixture({
  id: "tooltip",
  title: "Tooltip",
  description: "Short contextual helper text.",
  Component: TooltipSmokeFixture,
});
