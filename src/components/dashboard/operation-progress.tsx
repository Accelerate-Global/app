"use client";

import { Clock3Icon, Loader2Icon, WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type OperationProgressProps = {
  title: string;
  phase: string;
  detail?: string;
  value?: number;
  startedAt?: string | null;
  lastCheckedAt?: number | null;
  freshnessUnavailable?: boolean;
  showFreshness?: boolean;
  active?: boolean;
  className?: string;
};

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatFreshness(lastCheckedAt: number | null | undefined, now: number) {
  if (!lastCheckedAt) {
    return "Refreshing status automatically";
  }

  const seconds = Math.max(0, Math.floor((now - lastCheckedAt) / 1000));
  return seconds < 2
    ? "Status checked just now"
    : `Status checked ${seconds}s ago`;
}

export function OperationProgress({
  title,
  phase,
  detail,
  value,
  startedAt = null,
  lastCheckedAt = null,
  freshnessUnavailable = false,
  showFreshness,
  active = true,
  className,
}: OperationProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const parsedStartedAt = startedAt ? Date.parse(startedAt) : Number.NaN;
  const hasStartedAt = Number.isFinite(parsedStartedAt);
  const isDeterminate = typeof value === "number";
  const shouldShowFreshness = showFreshness ?? !isDeterminate;
  const boundedValue = isDeterminate ? Math.min(100, Math.max(0, value)) : null;

  useEffect(() => {
    if (!active || (!hasStartedAt && !lastCheckedAt)) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active, hasStartedAt, lastCheckedAt]);

  if (!active) {
    return null;
  }

  const freshnessText = freshnessUnavailable
    ? "Current status cannot be confirmed. Retrying automatically."
    : `${formatFreshness(lastCheckedAt, now)}.`;

  return (
    <div
      className={cn("space-y-3 rounded-lg border bg-background p-4", className)}
      data-operation-progress={isDeterminate ? "determinate" : "indeterminate"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{phase}</p>
          {detail ? (
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {boundedValue !== null ? (
            <span className="text-sm font-medium tabular-nums">
              {Math.round(boundedValue)}%
            </span>
          ) : null}
          {freshnessUnavailable ? (
            <WifiOffIcon className="size-5 text-amber-600" aria-hidden="true" />
          ) : (
            <Loader2Icon
              className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {boundedValue !== null ? (
        <Progress value={boundedValue} aria-label={title} />
      ) : (
        <div
          role="progressbar"
          aria-label={title}
          aria-valuetext={phase}
          className="relative h-1 w-full overflow-hidden rounded-full bg-muted"
        >
          <span className="operation-progress-indicator absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary motion-reduce:hidden" />
          <span className="absolute inset-y-0 left-0 hidden w-1/3 rounded-full bg-primary motion-reduce:block" />
        </div>
      )}

      {hasStartedAt || shouldShowFreshness ? (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {hasStartedAt ? (
          <span className="flex items-center gap-1" aria-hidden="true">
            <Clock3Icon className="size-3.5" />
            Elapsed {formatElapsed(now - parsedStartedAt)}
          </span>
        ) : null}
        {shouldShowFreshness ? (
          <span className={freshnessUnavailable ? "text-amber-700 dark:text-amber-400" : undefined}>
            {freshnessText}
          </span>
        ) : null}
      </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {phase}. {shouldShowFreshness ? freshnessText : ""}
      </p>
    </div>
  );
}

export { formatElapsed };
