# Source Notes

- Keep mutating `/api/**` request-origin enforcement, plus `POST /auth/sign-out`, centralized in `/Users/blake/Documents/accelerate-global/online/src/proxy.ts`.
- If a new API mutation needs an exception to the same-origin rule, document that exception in code and tests before changing the proxy behavior.
