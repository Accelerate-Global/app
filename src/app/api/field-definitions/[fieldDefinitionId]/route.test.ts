import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { updateFieldDefinition } from "@/lib/field-definitions";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-definitions", () => ({
  updateFieldDefinition: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateFieldDefinitionMock = vi.mocked(updateFieldDefinition);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    fieldDefinitionId: "field-1",
  }),
};

describe("/api/field-definitions/[fieldDefinitionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated updates", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/field-definitions/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          displayLabel: "",
          definition: "Country name",
        }),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(updateFieldDefinitionMock).not.toHaveBeenCalled();
  });

  it("rejects updates from non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/field-definitions/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          displayLabel: "",
          definition: "Country name",
        }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(updateFieldDefinitionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/field-definitions/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          displayLabel: "",
          definition: "x".repeat(1001),
        }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(updateFieldDefinitionMock).not.toHaveBeenCalled();
  });

  it("returns not found when the field definition does not exist", async () => {
    updateFieldDefinitionMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/field-definitions/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          displayLabel: "",
          definition: "Country name",
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("updates the field definition for admins", async () => {
    const fieldDefinition = {
      id: "field-1",
      canonicalKey: "geo_country_name",
      label: "Geo Country Name",
      displayLabel: "Country Name",
      definition: "Country name",
      linkedDatasets: [{ id: "dataset-1", fileName: "Global" }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateFieldDefinitionMock.mockResolvedValue(fieldDefinition);

    const response = await PATCH(
      new Request("http://localhost/api/field-definitions/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          displayLabel: "Country Name",
          definition: "Country name",
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ fieldDefinition });
    expect(updateFieldDefinitionMock).toHaveBeenCalledWith({
      fieldDefinitionId: "field-1",
      displayLabel: "Country Name",
      definition: "Country name",
    });
  });
});
