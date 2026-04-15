"use client";

import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function ProgressSmokeFixture() {
  return (
    <Progress value={68}>
      <ProgressLabel>Upload progress</ProgressLabel>
      <ProgressValue />
    </Progress>
  );
}

export default defineUiSmokeFixture({
  id: "progress",
  title: "Progress",
  description: "Determinate progress indicator.",
  Component: ProgressSmokeFixture,
});
