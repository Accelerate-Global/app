## Context

`src/lib/api-connections.ts` already owns saved admin API profiles, Vault-backed secret headers, safe outbound fetching, async run records, Supabase Storage output artifacts, and optional dataset imports. The supplied Etnopedia script proves the source behavior: list `Category:Peoples_by_name`, fetch main and `Talk:` page revisions in batches, parse header labels, map metadata, body sections, prayer points, and talk-page IDs/progress, then emit a fixed CSV column set plus a structured JSON array.

The existing API connection profile model is sufficient for storing the Etnopedia endpoint and import settings. The source has no API key, so no new secret or schema path is needed.

## Goals / Non-Goals

**Goals:**

- Make Etnopedia available as a first-class setup option on the API Connections page.
- Run the Etnopedia MediaWiki export inside the existing async run lifecycle.
- Match the script's CSV column names and structured JSON record shape closely enough for downstream import and inspection.
- Keep safe URL checks, redirect limits, per-request response-size protection, run logs, output downloads, and dataset create/replace imports.

**Non-Goals:**

- Do not add Drive upload behavior, local raw-file writes, or Python execution.
- Do not add a new database table, response format enum, Supabase migration, or stored source registry.
- Do not normalize Etnopedia data into canonical workspace fields beyond the existing API connection row import flow.

## Decisions

- Detect Etnopedia by URL instead of adding a new response format. A saved connection targeting `https://en.etnopedia.org/api.php` remains a normal JSON profile, but execution takes the provider-aware branch. This avoids a migration and keeps generic JSON/CSV profiles compatible.
- Add a client-side preset rather than a seeded private connection. Admins choose when to save, test, or import, and the app does not need to guess an environment-specific actor identity.
- Keep Etnopedia fetching in the server run path and parsing in a dedicated library module. `src/lib/etnopedia-api.ts` ports the script's deterministic parsing and exposes a request abstraction so tests can run without network access.
- Preserve output compatibility by returning normalized rows through the existing rows artifact and serializing the structured Etnopedia records as the raw JSON artifact. CSV downloads therefore use the existing UTF-8 BOM and CRLF behavior.
- Enforce existing safe-fetch behavior for each MediaWiki request. Category and revision responses are individually size-limited; the aggregate export can be larger because it is built from many bounded upstream responses and stored through the existing artifact path.

## Risks / Trade-offs

- URL-based provider detection is narrower than a dedicated provider column -> match only HTTPS `en.etnopedia.org/api.php` so unrelated connections are not affected.
- The full export can take longer than a single generic fetch -> keep batch progress logs and use the existing background `after()` run scheduling.
- Etnopedia wikitext can vary across pages -> port the proven parser heuristics directly and keep focused tests around header, body, map, and talk-page extraction.
- Output size can grow with the source -> retain per-request upstream limits and rely on existing Storage artifact handling for archived outputs.

## Migration Plan

No schema migration is required. Deploying the code adds the UI preset and Etnopedia execution branch for matching saved connections. Rollback removes the preset and branch; any saved Etnopedia profile remains an ordinary JSON API connection record.
