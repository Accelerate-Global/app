"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function AlertSmokeFixture() {
  return (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        Smoke fixtures keep shared primitives visible and deterministic.
      </AlertDescription>
      <AlertAction>Retry</AlertAction>
    </Alert>
  );
}

export default defineUiSmokeFixture({
  id: "alert",
  title: "Alert",
  description: "Status banners and inline notices.",
  Component: AlertSmokeFixture,
});
