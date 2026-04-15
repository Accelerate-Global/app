"use client";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function ButtonGroupSmokeFixture() {
  return (
    <ButtonGroup>
      <Button type="button" variant="outline">
        Previous
      </Button>
      <ButtonGroupSeparator />
      <ButtonGroupText>3 of 8</ButtonGroupText>
      <ButtonGroupSeparator />
      <Button type="button">Next</Button>
    </ButtonGroup>
  );
}

export default defineUiSmokeFixture({
  id: "button-group",
  title: "Button Group",
  description: "Grouped actions with separators and inline status.",
  Component: ButtonGroupSmokeFixture,
});
