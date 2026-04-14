"use client";

import {
  MapIcon,
  MicroscopeIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { DATASET_VIEW_OPTIONS } from "@/lib/dataset-view-options";

const VIEW_OPTIONS = DATASET_VIEW_OPTIONS.filter((option) => option.id !== "global").map(
  (option) => ({
    ...option,
    icon:
      option.id === "region"
        ? MapIcon
        : option.id === "watchlist"
          ? MicroscopeIcon
          : UserRoundIcon,
  }),
 ) satisfies ReadonlyArray<{
  id: "region" | "watchlist" | "uupg";
  title: string;
  description: string;
  defaultChecked: boolean;
  icon: LucideIcon;
}>;

type ViewOptionId = (typeof VIEW_OPTIONS)[number]["id"];

const INITIAL_VIEW_STATES = VIEW_OPTIONS.reduce<Record<ViewOptionId, boolean>>(
  (states, option) => {
    states[option.id] = option.defaultChecked;
    return states;
  },
  {} as Record<ViewOptionId, boolean>,
);

export function DatasetViewSwitchGrid() {
  const [viewStates, setViewStates] = useState(INITIAL_VIEW_STATES);

  return (
    <FieldGroup className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;

        return (
          <FieldLabel
            key={option.id}
            htmlFor={`dataset-view-${option.id}`}
            className="rounded-[1.25rem] border-border/80 bg-card/95 p-0! shadow-sm transition-colors hover:bg-accent/10 has-data-checked:border-foreground/18 has-data-checked:bg-accent/16"
          >
            <Field
              orientation="horizontal"
              className="h-full min-h-[10.5rem] items-start justify-between gap-4 px-4 py-4 sm:min-h-[9.5rem]"
            >
              <FieldContent className="gap-3">
                <FieldTitle className="items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-xs shadow-black/5">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-base font-semibold tracking-[-0.02em]">
                      {option.title}
                    </span>
                    <FieldDescription className="text-sm leading-5 text-balance">
                      {option.description}
                    </FieldDescription>
                  </div>
                </FieldTitle>
              </FieldContent>
              <Switch
                id={`dataset-view-${option.id}`}
                size="sm"
                checked={viewStates[option.id]}
                onCheckedChange={(checked) =>
                  setViewStates((current) => ({
                    ...current,
                    [option.id]: checked,
                  }))
                }
              />
            </Field>
          </FieldLabel>
        );
      })}
    </FieldGroup>
  );
}
