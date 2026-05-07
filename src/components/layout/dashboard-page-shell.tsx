import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DASHBOARD_CONTENT_WIDTH_CLASS = "max-w-7xl";

type DashboardPageShellProps = {
  children: ReactNode;
  className?: string;
  gap?: "default" | "compact";
};

export function DashboardPageShell({
  children,
  className,
  gap = "default",
}: DashboardPageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col px-4 py-10 sm:px-6 lg:px-8",
        DASHBOARD_CONTENT_WIDTH_CLASS,
        gap === "compact" ? "gap-6" : "gap-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
