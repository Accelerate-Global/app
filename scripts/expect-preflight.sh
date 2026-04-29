#!/usr/bin/env bash
set -euo pipefail

EXPECT_AGENT="${EXPECT_AGENT:-codex}"
EXPECT_TARGET="${EXPECT_TARGET:-changes}"
EXPECT_URL="${EXPECT_URL:-http://localhost:3000}"
EXPECT_VERSION="${EXPECT_VERSION:-latest}"
EXPECT_TIMEOUT="${EXPECT_TIMEOUT:-900000}"
EXPECT_OUTPUT="${EXPECT_OUTPUT:-text}"
EXPECT_MESSAGE="${EXPECT_MESSAGE:-Test only the browser-facing behavior affected by the current git changes. Because the connected Supabase project is production, prefer unauthenticated checks and read-only authenticated checks only when explicitly approved. Focus on changed routes, navigation, auth redirects, Supabase-backed screens, forms, tables, console errors, failed network requests, accessibility smoke issues, and obvious performance regressions. Do not broaden into unrelated full-regression testing. Do not create, update, delete, invite, publish, revoke, reset, or otherwise mutate production data. Do not save or expose secrets, cookies, storage state, traces, screenshots, videos, downloads, or production data artifacts.}"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

args=(
  "tui"
  "--agent" "$EXPECT_AGENT"
  "--target" "$EXPECT_TARGET"
  "--url" "$EXPECT_URL"
  "--timeout" "$EXPECT_TIMEOUT"
  "--output" "$EXPECT_OUTPUT"
  "--message" "$EXPECT_MESSAGE"
)

if [[ "${EXPECT_USE_COOKIES:-0}" != "1" ]]; then
  args+=("--no-cookies")
fi

if [[ "${EXPECT_YES:-0}" == "1" ]]; then
  args+=("--yes")
fi

npx -y "expect-cli@${EXPECT_VERSION}" "${args[@]}" "$@"
