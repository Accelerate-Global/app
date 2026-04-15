"use client";

import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_FIELD_DEFINITION_TOOLTIP =
  "No definition available yet.";

export function getFieldDefinitionTooltipText(definition: string) {
  const trimmedDefinition = definition.trim();

  return trimmedDefinition || DEFAULT_FIELD_DEFINITION_TOOLTIP;
}

export function FieldDefinitionHeaderInfo({
  label,
  definition,
}: {
  label: string;
  definition: string;
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
            className="size-5 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon aria-hidden="true" className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-80 rounded-2xl px-3.5 py-2.5 text-sm leading-5"
      >
        <p className="text-left">
          <span className="font-medium">{label}:</span>{" "}
          <span className="whitespace-pre-line">{tooltipText}</span>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
