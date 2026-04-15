import type { ComponentType } from "react";

export type UiSmokeFixture = {
  id: string;
  title: string;
  description?: string;
  Component: ComponentType;
};

export function defineUiSmokeFixture(fixture: UiSmokeFixture) {
  return fixture;
}
