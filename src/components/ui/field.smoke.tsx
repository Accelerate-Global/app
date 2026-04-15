"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function FieldSmokeFixture() {
  return (
    <FieldSet>
      <FieldLegend>Field Group</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldContent>
            <FieldTitle>Dataset name</FieldTitle>
            <FieldDescription>
              Shared field wrappers keep labels, descriptions, and inputs aligned.
            </FieldDescription>
          </FieldContent>
          <Input defaultValue="Smoke Dataset" />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

export default defineUiSmokeFixture({
  id: "field",
  title: "Field",
  description: "Structured field layout with title and description.",
  Component: FieldSmokeFixture,
});
