"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function DropdownMenuSmokeFixture() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-smoke-trigger="fixture-dropdown-menu"
          />
        }
      >
        Open menu
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-smoke-surface="fixture-dropdown-menu"
        data-smoke-ready="fixture-dropdown-menu"
      >
        <DropdownMenuLabel>Fixture Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Open</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default defineUiSmokeFixture({
  id: "dropdown-menu",
  title: "Dropdown Menu",
  description: "Context menus and account menus.",
  Component: DropdownMenuSmokeFixture,
});
