## Context

The account menu already routes administrators to `/dashboard/field-sources`,
but its label is longer than the destination title. The partner-export profile
editor is implemented as a right-side shared Sheet whose primitive applies a
side-specific `sm:max-w-sm`; the feature-level `sm:max-w-5xl` does not reliably
override that selector. Completed artifacts are private and authorized, but
their response filenames currently contain only the profile filename stem.

## Goals / Non-Goals

**Goals:**

- Use the concise `Field Sources` navigation label while preserving the route,
  icon, prefetching, and admin-only visibility.
- Make the export editor full-width on mobile and exactly half the viewport at
  the `sm` breakpoint and above.
- Build safe download filenames from the source dataset name, saved profile
  stem, and the UTC time of the HTTP download request.
- Apply the traceable naming rule consistently to CSV, crosswalk, and validation
  artifacts.

**Non-Goals:**

- Change profile persistence, the 13 Joshua Project headers, transformations,
  artifact contents, Storage object paths, authorization, or source datasets.
- Add a database migration, new dependency, public URL, or external delivery.
- Rename the `/dashboard/field-sources` or partner-export API routes.

## Decisions

1. The feature Sheet will use side-qualified responsive Tailwind utilities for
   `sm:w-1/2` and `sm:max-w-none`. Matching the shared primitive's side variant
   ensures the feature override wins without widening every Sheet in the app.
   Changing the shared primitive was rejected because other sheets intentionally
   use its narrow default.
2. A pure partner-export filename helper will sanitize the dataset and profile
   fragments, remove a trailing CSV extension from either fragment, format the
   request time as a filesystem-safe UTC ISO timestamp to second precision, and
   append the artifact-specific suffix. A pure helper makes edge cases and the
   timestamp deterministic in unit tests.
3. The server will resolve the source dataset during authorized download and
   call the helper with `new Date()` only after the requested completed run and
   artifact are found. Using the request time rather than generation time
   implements "timestamp of download" and allows repeated downloads to be
   distinguished.
4. Storage paths and immutable artifacts retain their existing profile-based
   names. Only the response `Content-Disposition` changes, avoiding artifact
   rewrites or migrations.

## Risks / Trade-offs

- [Risk] Half the viewport can still feel narrow on small tablets. → Mobile is
  full-width; the existing scrollable editor and responsive column layout remain.
- [Risk] Dataset/profile names may contain unsafe characters or `.csv`. → Reuse
  the repository filename sanitizer and strip only trailing CSV extensions.
- [Risk] Multiple downloads within one second can share a filename. → The UTC
  second timestamp meets the user-facing requirement without noisy milliseconds;
  browsers retain their normal collision handling.
- [Risk] Resolving the source name adds a database lookup. → The download path is
  admin-only and low-frequency, and no schema or RLS behavior changes.

## Migration Plan

Deploy as a backward-compatible UI and response-header change. Existing profiles,
runs, Storage objects, and URLs remain valid. Rollback reverts the labels, width
utilities, and response filename helper without data migration.

## Open Questions

None.
