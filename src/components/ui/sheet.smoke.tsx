"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SheetSmokeFixture() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-smoke-trigger="fixture-sheet"
          />
        }
      >
        Open sheet
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm"
        data-smoke-surface="fixture-sheet"
        data-smoke-ready="fixture-sheet"
      >
        <SheetHeader>
          <SheetTitle>Fixture Sheet</SheetTitle>
          <SheetDescription>
            Sheets are opened and closed by the smoke crawler.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-2 text-sm text-muted-foreground">
          Sheet content renders in a side panel.
        </div>
        <SheetFooter className="sm:flex-row sm:justify-end">
          <SheetClose
            render={
              <Button
                type="button"
                variant="outline"
                data-smoke-close="fixture-sheet"
              />
            }
          >
            Close
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default defineUiSmokeFixture({
  id: "sheet",
  title: "Sheet",
  description: "Side panel overlay primitive.",
  Component: SheetSmokeFixture,
});
