"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function PopoverSmokeFixture() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-smoke-trigger="fixture-popover"
          />
        }
      >
        Open popover
      </PopoverTrigger>
      <PopoverContent
        data-smoke-surface="fixture-popover"
        data-smoke-ready="fixture-popover"
      >
        <PopoverHeader>
          <PopoverTitle>Fixture Popover</PopoverTitle>
          <PopoverDescription>
            Popovers are exercised by the generic smoke crawler.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export default defineUiSmokeFixture({
  id: "popover",
  title: "Popover",
  description: "Anchor-positioned floating content.",
  Component: PopoverSmokeFixture,
});
