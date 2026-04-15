import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { updateFieldSourceValue } from "@/lib/field-sources";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-sources", () => ({
  updateFieldSourceValue: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateFieldSourceValueMock = vi.mocked(updateFieldSourceValue);

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

describe("/api/field-sources/[fieldDefinitionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated updates", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/field-sources/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          sourceTypeId: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
          sourceFieldName: "ROP3",
        }),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(updateFieldSourceValueMock).not.toHaveBeenCalled();
  });

  it("rejects updates from non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/field-sources/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          sourceTypeId: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
          sourceFieldName: "ROP3",
        }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(updateFieldSourceValueMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/field-sources/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          sourceTypeId: "not-a-uuid",
          sourceFieldName: "ROP3",
        }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(updateFieldSourceValueMock).not.toHaveBeenCalled();
  });

  it("returns not found when the field source row does not exist", async () => {
    updateFieldSourceValueMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/field-sources/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          sourceTypeId: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
          sourceFieldName: "ROP3",
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("updates the field source cell for admins", async () => {
    const fieldSource = {
      fieldDefinitionId: "field-1",
      canonicalKey: "pg_rop3",
      label: "PG_ROP3",
      displayLabel: "",
      effectiveLabel: "PG_ROP3",
      definition: "",
      mappingFieldId: "F_71",
      mappingDataType: "Integer",
      mappingIsActive: true,
      sourcePriorityKeys: ["joshua_project"],
      sourceValues: {
        "4c2f6b2f-0f97-4c35-9475-1c3168fa630d": "ROP3",
      },
      linkedSources: [
        {
          id: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
          key: "joshua_project",
          label: "Joshua Project",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateFieldSourceValueMock.mockResolvedValue(fieldSource);

    const response = await PATCH(
      new Request("http://localhost/api/field-sources/field-1", {
        method: "PATCH",
        body: JSON.stringify({
          sourceTypeId: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
          sourceFieldName: "ROP3",
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ fieldSource });
    expect(updateFieldSourceValueMock).toHaveBeenCalledWith({
      fieldDefinitionId: "field-1",
      sourceTypeId: "4c2f6b2f-0f97-4c35-9475-1c3168fa630d",
      sourceFieldName: "ROP3",
    });
  });
});
