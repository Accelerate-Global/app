import {
  fetchEtnopediaPeopleGroups,
  isEtnopediaApiUrl,
} from "@/lib/etnopedia-api";

import {
  ApiConnectionError,
  REQUEST_TIMEOUT_MS,
  fetchWithSafeRedirects,
  parseApiResponseRows,
  readLimitedResponse,
  redactSecrets,
} from "../core";
import type { ConnectionProvider } from "../provider";

function createEtnopediaRequestJson(input: {
  url: string;
  headers: Headers;
  secrets: Map<string, string>;
}) {
  return async (params: Record<string, string>, method: "GET" | "POST") => {
    const headers = new Headers(input.headers);
    let url = input.url;
    let body: BodyInit | undefined;

    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", "Etnopedia-WebExport/1.0 (+accelerate-global)");
    }

    if (method === "GET") {
      const requestUrl = new URL(url);

      for (const [key, value] of Object.entries(params)) {
        requestUrl.searchParams.set(key, value);
      }

      url = requestUrl.toString();
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8");
      }

      body = new URLSearchParams(params);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetchWithSafeRedirects({
        url,
        init: {
          method,
          headers,
          body,
          signal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseBody = await readLimitedResponse(response);

    if (!response.ok) {
      throw new ApiConnectionError(
        `Etnopedia API request failed with HTTP ${response.status}.`,
        502,
      );
    }

    try {
      return JSON.parse(responseBody) as unknown;
    } catch {
      const snippet = redactSecrets(
        responseBody.slice(0, 240).replace(/[\r\n]+/g, " ").trim(),
        input.secrets,
      );

      throw new ApiConnectionError(
        `Etnopedia API returned a non-JSON response. Body starts with: ${snippet}`,
        502,
      );
    }
  };
}


export const etnopediaProvider: ConnectionProvider = {
  name: "etnopedia",
  matches: ({ connection }) => isEtnopediaApiUrl(connection.url),
  fetch: async ({ requestConfig, secrets, log }) => {
    try {
      const result = await fetchEtnopediaPeopleGroups({
        requestJson: createEtnopediaRequestJson({
          url: requestConfig.url,
          headers: requestConfig.headers,
          secrets,
        }),
        log,
      });

      return {
        body: JSON.stringify(result.records),
        httpStatus: 200,
        parsed: null,
      };
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        throw error;
      }

      throw new ApiConnectionError(
        error instanceof Error ? error.message : "Etnopedia export failed.",
        502,
      );
    }
  },
  parse: ({ body, connection }) =>
    parseApiResponseRows({
      body,
      responseFormat: connection.responseFormat,
      responseDataPath: connection.responseDataPath,
      connectionUrl: connection.url,
    }),
};
