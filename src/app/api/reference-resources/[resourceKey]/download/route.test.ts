import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createReferenceResourceCsvStream, getActiveReferenceResourceVersion } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({
  ...(await original<typeof import("@/lib/reference-resources")>()),
  createReferenceResourceCsvStream: vi.fn(),
  getActiveReferenceResourceVersion: vi.fn(),
}));

describe("reference resource download route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("streams the complete matching active CSV with attachment headers", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "owner-1", email: null, fullName: null, workspaceRole: "basic", isDatasetAdmin: false, mode: "supabase" });
    vi.mocked(getActiveReferenceResourceVersion).mockResolvedValue({} as never);
    vi.mocked(createReferenceResourceCsvStream).mockReturnValue(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("header\nrow\n")); controller.close(); } }));
    const response = await GET(new Request("http://localhost/api/reference-resources/rop-codes/download?search=Arab"), { params: Promise.resolve({ resourceKey: "rop-codes" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("rop-codes.csv");
    expect(createReferenceResourceCsvStream).toHaveBeenCalledWith({ resourceKey: "rop-codes", search: "Arab" });
    await expect(response.text()).resolves.toBe("header\nrow\n");
  });
});
