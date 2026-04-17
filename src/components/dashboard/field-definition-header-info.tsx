"use client";

import { InfoIcon } from "lucide-react";

import { FieldSourceTagList } from "@/components/dashboard/field-source-tag-list";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FieldDefinitionLinkedSource } from "@/lib/api-types";

const DEFAULT_FIELD_DEFINITION_TOOLTIP =
  "No definition available yet.";
const FIELD_INFO_TOOLTIP_CONTENT_CLASSNAME =
  "max-w-[26rem] rounded-2xl border border-border/80 bg-popover px-4 py-3.5 text-sm leading-6 text-popover-foreground shadow-lg ring-1 ring-foreground/8";

export function getFieldDefinitionTooltipText(definition: string) {
  const trimmedDefinition = definition.trim();

  return trimmedDefinition || DEFAULT_FIELD_DEFINITION_TOOLTIP;
}

export function FieldDefinitionHeaderInfo({
  label,
  definition,
  linkedSources,
}: {
  label: string;
  definition: string;
  linkedSources: FieldDefinitionLinkedSource[];
}) {
  const tooltipText = getFieldDefinitionTooltipText(definition);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`View definition for ${label}`}
            data-smoke-trigger="field-definition-tooltip"
            data-smoke-write="safe"
            className="size-5 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className={FIELD_INFO_TOOLTIP_CONTENT_CLASSNAME}
        data-smoke-surface="field-definition-tooltip"
        data-smoke-ready="field-definition-tooltip"
      >
        <div className="space-y-2 text-left">
          <div className="space-y-1.5">
            <p className="font-medium tracking-[-0.01em] text-popover-foreground">
              {label}
            </p>
            <p className="whitespace-pre-line text-popover-foreground">
              {tooltipText}
            </p>
          </div>
          {linkedSources.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Sources
              </p>
              <FieldSourceTagList linkedSources={linkedSources} />
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
