import {
  ApiConnectionError,
  REQUEST_TIMEOUT_MS,
  fetchWithSafeRedirects,
  parseApiResponseRows,
  readLimitedResponse,
} from "../core";
import type { ConnectionProvider } from "../provider";

export const genericHttpProvider: ConnectionProvider = {
  name: "http_api",
  matches: () => true,
  fetch: async ({ connection, requestConfig, onHttpStatus }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetchWithSafeRedirects({
        url: requestConfig.url,
        init: {
          method: connection.method,
          headers: requestConfig.headers,
          body: requestConfig.body,
          signal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    onHttpStatus(response.status);
    const body = await readLimitedResponse(response);

    if (!response.ok) {
      throw new ApiConnectionError(
        `API request failed with HTTP ${response.status}.`,
        502,
      );
    }

    return {
      body,
      httpStatus: response.status,
      parsed: null,
    };
  },
  parse: ({ body, connection }) =>
    parseApiResponseRows({
      body,
      responseFormat: connection.responseFormat,
      responseDataPath: connection.responseDataPath,
      connectionUrl: connection.url,
    }),
};
