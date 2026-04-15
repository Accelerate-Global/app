"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function SkeletonSmokeFixture() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export default defineUiSmokeFixture({
  id: "skeleton",
  title: "Skeleton",
  description: "Loading placeholders.",
  Component: SkeletonSmokeFixture,
});
