"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { defineUiSmokeFixture } from "@/lib/ui-smoke"

function DialogSmokeFixture() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-smoke-trigger="fixture-dialog"
          />
        }
      >
        Open dialog
      </DialogTrigger>
      <DialogContent
        data-smoke-surface="fixture-dialog"
        data-smoke-ready="fixture-dialog"
      >
        <DialogHeader>
          <DialogTitle>Fixture Dialog</DialogTitle>
          <DialogDescription>
            Dialogs are opened and closed by the smoke crawler.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 pb-2 text-sm text-muted-foreground">
          Dialog content renders in a centered modal.
        </div>
        <DialogFooter className="border-t border-border/70 sm:flex-row sm:justify-end">
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                data-smoke-close="fixture-dialog"
              />
            }
          >
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default defineUiSmokeFixture({
  id: "dialog",
  title: "Dialog",
  description: "Centered modal overlay primitive.",
  Component: DialogSmokeFixture,
})
