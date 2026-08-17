import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checksumApiConnectionArtifact } from "@/lib/api-connection-output";
import {
  createRawChunkDownloadStream,
  createRowsChunkCsvDownloadStream,
  uploadApiConnectionRunChunk,
} from "./chunked-output";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const createClientMock = vi.mocked(createSupabaseAdminClient);
const columns = [{ key: "name", label: "Name", sourceIndex: 0 }];

async function readStream(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

describe("chunked API connection output", () => {
  beforeEach(() => vi.resetAllMocks());

  it("streams raw page arrays as one legacy-compatible JSON artifact", async () => {
    const values = new Map([
      ["raw-1", '[{"id":1}]'],
      ["raw-2", '[{"id":2}]'],
    ]);
    createClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async (path: string) => ({
            data: new Blob([values.get(path) ?? ""]),
            error: null,
          })),
        })),
      },
    } as never);

    const body = await readStream(
      createRawChunkDownloadStream({
        schemaVersion: 1,
        kind: "api-connection-raw-chunks",
        runId: "run-1",
        connectionId: "connection-1",
        mode: "test",
        responseFormat: "json",
        responseDataPath: "",
        httpStatus: 200,
        rowCount: 2,
        chunks: [
          { page: 1, path: "raw-1", rowCount: 1, sizeBytes: 10, checksum: checksumApiConnectionArtifact(values.get("raw-1")!) },
          { page: 2, path: "raw-2", rowCount: 1, sizeBytes: 10, checksum: checksumApiConnectionArtifact(values.get("raw-2")!) },
        ],
      }),
    );

    const parsed = JSON.parse(body);
    expect(JSON.parse(parsed.rawResponse)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("streams ordered rows chunks as spreadsheet-safe CSV", async () => {
    const artifact = JSON.stringify({
      columns,
      rows: [{ name: "Alpha" }, { name: "=DANGER()" }],
    });
    createClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({ data: new Blob([artifact]), error: null })),
        })),
      },
    } as never);

    const body = await readStream(
      createRowsChunkCsvDownloadStream({
        schemaVersion: 1,
        kind: "api-connection-rows-chunks",
        columns,
        rowCount: 2,
        chunks: [
          { page: 1, path: "rows-1", rowCount: 2, sizeBytes: 20, checksum: checksumApiConnectionArtifact(artifact) },
        ],
      }),
    );

    expect(body).toContain("Name\r\nAlpha\r\n'=DANGER()\r\n");
  });

  it("uses deterministic create-only uploads", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
    } as never);

    const result = await uploadApiConnectionRunChunk({
      runId: "run-1",
      kind: "rows",
      page: 2,
      rowCount: 1,
      content: "{}",
    });

    expect(result.path).toBe("api-connection-runs/run-1/chunks/rows-000002.json");
    expect(upload).toHaveBeenCalledWith(
      result.path,
      expect.any(Blob),
      expect.objectContaining({ upsert: false }),
    );
  });

});
