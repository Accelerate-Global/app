"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function CardSmokeFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Smoke Card</CardTitle>
        <CardDescription>
          Shared cards provide structured layout primitives.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" variant="outline">
            Inspect
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Card body content stays readable in smoke mode.</CardContent>
      <CardFooter>Footer actions and metadata live here.</CardFooter>
    </Card>
  );
}

export default defineUiSmokeFixture({
  id: "card",
  title: "Card",
  description: "Structured content container.",
  Component: CardSmokeFixture,
});
