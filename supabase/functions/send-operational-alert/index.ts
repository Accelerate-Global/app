import { createOperationalAlertHandler } from "./handler.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const handleOperationalAlertRequest = createOperationalAlertHandler({
  getEnvironment: (name) => Deno.env.get(name),
  fetch,
});

Deno.serve(handleOperationalAlertRequest);
