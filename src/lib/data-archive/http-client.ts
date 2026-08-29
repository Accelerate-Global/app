import type { IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";

export type ArchiveFetchResponse = Pick<
  Response,
  "ok" | "status" | "statusText" | "json" | "text"
>;

export type ArchiveFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal | null;
};

export type ArchiveFetch = (
  input: string | URL,
  init?: ArchiveFetchInit,
) => Promise<ArchiveFetchResponse>;

type RequestImplementation = typeof httpsRequest;

const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readResponseBody(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_RESPONSE_BYTES) {
      response.destroy(new Error("archive_http_response_too_large"));
      throw new Error("archive_http_response_too_large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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

    return new Promise<ArchiveFetchResponse>((resolve, reject) => {
      const options: RequestOptions = {
        method: init.method ?? "GET",
        headers: init.headers,
      };
      const request = requestImpl(url, options, (response) => {
        void readResponseBody(response).then((body) => {
          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: response.statusMessage ?? "",
            text: async () => body,
            json: async () => JSON.parse(body) as unknown,
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
