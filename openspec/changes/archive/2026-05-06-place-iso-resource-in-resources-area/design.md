## Context

The API Connections page already has a Resources card for referenced documents
captured from successful API connection runs. The ISO3 country-code lookup is a
separate authenticated dashboard route, but the current placement makes it easy
to miss from the Resources card shown in the API Connections workflow.

## Goals / Non-Goals

**Goals:**

- Show a stable built-in ISO3 country-code resource in the API Connections
  Resources card.
- Keep captured API-run resources visible when present.
- Keep the empty captured-resource message accurate by scoping it to captured
  resources rather than all resources.

**Non-Goals:**

- Do not add database-backed resource records.
- Do not change the ISO refresh endpoint or generated resource snapshot.
- Do not change API connection run output persistence.

## Decisions

- Render the ISO3 lookup as a built-in resource row before captured resources.
  This keeps the resource visible even when no API-run resources have been
  captured and avoids database writes for static reference data.
- Keep the destination internal (`/dashboard/country-codes`) instead of opening
  ISO directly. The internal page provides search, copy, JSON download, and live
  refresh controls.

## Risks / Trade-offs

- Users may read the Resources description as only captured API-run documents ->
  update the copy to include built-in references and captured resources.
- The table mixes internal and external URLs -> render the built-in row with
  the same Open action and a relative href, while captured resources keep their
  external URLs.
