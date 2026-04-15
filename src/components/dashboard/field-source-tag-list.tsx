"use client";

import type { FieldDefinitionLinkedSource } from "@/lib/api-types";

import { BadgeTagList } from "@/components/dashboard/badge-tag-list";

type FieldSourceTagListProps = {
  linkedSources: FieldDefinitionLinkedSource[];
  className?: string;
};

export function FieldSourceTagList({
  linkedSources,
  className,
}: FieldSourceTagListProps) {
  return (
    <BadgeTagList
      items={linkedSources.map((linkedSource) => ({
        id: linkedSource.id,
        label: linkedSource.label,
      }))}
      className={className}
      badgeClassName="border-border/80 bg-muted/35 text-foreground"
    />
  );
}
