"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type BadgeTagListItem = {
  id: string;
  label: string;
  style?: CSSProperties;
  className?: string;
};

type BadgeTagListProps = {
  items: BadgeTagListItem[];
  className?: string;
  badgeClassName?: string;
};

export function BadgeTagList({
  items,
  className,
  badgeClassName,
}: BadgeTagListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-medium leading-none",
            badgeClassName,
            item.className,
          )}
          style={item.style}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
