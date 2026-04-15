import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createFieldSourceType,
  FieldSourceTypeConflictError,
} from "@/lib/field-sources";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/field-sources", () => ({
  createFieldSourceType: vi.fn(),
  FieldSourceTypeConflictError: class FieldSourceTypeConflictError extends Error {},
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createFieldSourceTypeMock = vi.mocked(createFieldSourceType);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/field-source-types", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated creates", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/field-source-types", {
        method: "POST",
        body: JSON.stringify({ label: "WCD" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(createFieldSourceTypeMock).not.toHaveBeenCalled();
  });

  it("rejects creates from non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/field-source-types", {
        method: "POST",
        body: JSON.stringify({ label: "WCD" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createFieldSourceTypeMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/field-source-types", {
        method: "POST",
        body: JSON.stringify({ label: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createFieldSourceTypeMock).not.toHaveBeenCalled();
  });

  it("returns conflicts for duplicate source columns", async () => {
    createFieldSourceTypeMock.mockRejectedValue(
      new FieldSourceTypeConflictError("A source column with that name already exists."),
    );

    const response = await POST(
      new Request("http://localhost/api/field-source-types", {
        method: "POST",
        body: JSON.stringify({ label: "WCD" }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("creates source columns for admins", async () => {
    const fieldSourceType = {
      id: "source-1",
      key: "wcd",
      label: "WCD",
      sortOrder: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createFieldSourceTypeMock.mockResolvedValue(fieldSourceType);

    const response = await POST(
      new Request("http://localhost/api/field-source-types", {
        method: "POST",
        body: JSON.stringify({ label: "WCD" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ fieldSourceType });
    expect(createFieldSourceTypeMock).toHaveBeenCalledWith({ label: "WCD" });
  });
});
