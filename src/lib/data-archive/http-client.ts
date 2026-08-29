import type { IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";

export type ArchiveFetchResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "arrayBuffer" | "json" | "text"
>;

export type ArchiveFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  maxResponseBytes?: number;
  signal?: AbortSignal | null;
};

export type ArchiveFetch = (
  input: string | URL,
  init?: ArchiveFetchInit,
) => Promise<ArchiveFetchResponse>;

type RequestImplementation = typeof httpsRequest;

const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readResponseBody(
  response: IncomingMessage,
  maxResponseBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxResponseBytes) {
      response.destroy(new Error("archive_http_response_too_large"));
      throw new Error("archive_http_response_too_large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function createArchiveFetch(
  requestImpl: RequestImplementation = httpsRequest,
): ArchiveFetch {
  return async (input, init = {}) => {
    const url = input instanceof URL ? input : new URL(input);
    if (url.protocol !== "https:") {
      throw new Error("archive_http_requires_https");
    }
    if (init.signal?.aborted) {
      throw init.signal.reason ?? new Error("archive_http_aborted");
    }
    const maxResponseBytes = init.maxResponseBytes ?? MAX_RESPONSE_BYTES;
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 0) {
      throw new Error("archive_http_response_limit_invalid");
    }

    return new Promise<ArchiveFetchResponse>((resolve, reject) => {
      const options: RequestOptions = {
        method: init.method ?? "GET",
        headers: init.headers,
      };
      const request = requestImpl(url, options, (response) => {
        void readResponseBody(response, maxResponseBytes).then((body) => {
          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: response.statusMessage ?? "",
            arrayBuffer: async () => body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength,
            ) as ArrayBuffer,
            text: async () => body.toString("utf8"),
            json: async () => JSON.parse(body.toString("utf8")) as unknown,
          });
        }, reject);
      });

      const abort = () => {
        request.destroy(init.signal?.reason ?? new Error("archive_http_aborted"));
      };
      init.signal?.addEventListener("abort", abort, { once: true });
      request.once("error", reject);
      request.once("close", () => init.signal?.removeEventListener("abort", abort));
      request.end(init.body);
    });
  };
}

export const archiveFetch = createArchiveFetch();
