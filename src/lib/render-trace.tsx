"use client";

import { Profiler, type ProfilerOnRenderCallback, type ReactNode, useLayoutEffect } from "react";

type RenderTraceBucket = {
  count: number;
  keys: Record<string, number>;
};

type RenderTraceProfilerEvent = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

type RenderTraceTimingBucket = {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

type RenderTraceStore = {
  enabled: boolean;
  renders: Record<string, RenderTraceBucket>;
  profilerEvents: RenderTraceProfilerEvent[];
  timings: Record<string, RenderTraceTimingBucket>;
};

type RenderTraceWindow = Window & {
  __datasetDetailPerfRenderTrace?: RenderTraceStore;
};

function getRenderTraceStore() {
  if (typeof window === "undefined") {
    return null;
  }

  const store = (window as RenderTraceWindow).__datasetDetailPerfRenderTrace;

  if (!store?.enabled) {
    return null;
  }

  return store;
}

export function useDatasetPerfRenderTrace(name: string, key?: string | number | null) {
  useLayoutEffect(() => {
    const store = getRenderTraceStore();

    if (!store) {
      return;
    }

    const bucket = (store.renders[name] ??= {
      count: 0,
      keys: {},
    });

    bucket.count += 1;

    if (key !== undefined && key !== null) {
      const normalizedKey = String(key);
      bucket.keys[normalizedKey] = (bucket.keys[normalizedKey] ?? 0) + 1;
    }
  });
}

function getTimingNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export function measureDatasetPerfTiming<T>(name: string, callback: () => T) {
  const store = getRenderTraceStore();

  if (!store) {
    return callback();
  }

  const startedAt = getTimingNow();
  const result = callback();
  const durationMs = getTimingNow() - startedAt;
  const bucket = (store.timings[name] ??= {
    count: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
  });

  bucket.count += 1;
  bucket.totalDurationMs += durationMs;
  bucket.maxDurationMs = Math.max(bucket.maxDurationMs, durationMs);

  return result;
}

const handleProfilerRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  const store = getRenderTraceStore();

  if (!store) {
    return;
  }

  store.profilerEvents.push({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  });
};

export function DatasetPerfProfiler({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <Profiler id={id} onRender={handleProfilerRender}>
      {children}
    </Profiler>
  );
}
