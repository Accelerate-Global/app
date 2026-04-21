# Library Notes

- `/Users/blake/Documents/accelerate-global/online/src/lib/request-security.ts` owns the same-origin policy for mutating `/api/**` requests and `POST /auth/sign-out`.
- `/Users/blake/Documents/accelerate-global/online/src/lib/security-headers.ts` owns the repo-defined CSP and browser hardening header set consumed by `next.config.ts`.
- `/Users/blake/Documents/accelerate-global/online/src/lib/error-logging.ts` is the shared path for normalized provider-error logging. Do not log raw provider objects from auth, storage, or admin helpers.
