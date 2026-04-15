import type { FieldDefinition } from "@/lib/api-types";

export function getFieldDefinitionEffectiveLabel(
  fieldDefinition: Pick<FieldDefinition, "label" | "displayLabel">,
) {
  const displayLabel = fieldDefinition.displayLabel.trim();

  return displayLabel || fieldDefinition.label;
}
