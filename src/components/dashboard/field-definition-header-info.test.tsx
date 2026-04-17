// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FieldDefinitionHeaderInfo,
  getFieldDefinitionTooltipText,
} from "./field-definition-header-info";

describe("FieldDefinitionHeaderInfo", () => {
  it("returns a placeholder when the definition is blank", () => {
    expect(getFieldDefinitionTooltipText("   ")).toBe(
      "No definition available yet.",
    );
  });

  it("returns the trimmed definition when content exists", () => {
    expect(getFieldDefinitionTooltipText("  The country tied to the row.  ")).toBe(
      "The country tied to the row.",
    );
  });

  it("renders the info icon button for the field", () => {
    render(
      <FieldDefinitionHeaderInfo
        label="Geo Country Name"
        definition="The country tied to the current row."
        linkedSources={[
          {
            id: "source-1",
            key: "joshua_project",
            label: "Joshua Project",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "View definition for Geo Country Name",
      }),
    ).toBeTruthy();
  });
});
