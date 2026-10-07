#!/usr/bin/env bash
# Fixed verification recipe. Called while the service holds the shared VM lock.
set -euo pipefail
readonly task_path="${1:?task worktree required}"
cd "$task_path"
readonly project_root="$(git rev-parse --show-toplevel)"
[[ "$project_root" == "$task_path" ]]
cleanup_services=0
cleanup() {
  if [[ "$cleanup_services" == 1 ]]; then
    pnpm exec supabase stop || true
    docker builder prune -af || true
  fi
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
brief="$(pnpm run task:kickoff -- --scope '**')"
printf '%s\n' "$brief"
if [[ "$brief" == *'Local Supabase: required by '* ]]; then
  cleanup_services=1
  pnpm exec supabase stop
  pnpm exec supabase start
fi
pnpm run verify:change:run
