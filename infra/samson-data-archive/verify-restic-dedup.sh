#!/bin/sh
set -eu

fixture_root=$(mktemp -d /var/cache/ax-data-archive/restic-verification.XXXXXX)
trap 'rm -rf "$fixture_root"' EXIT
repository="$fixture_root/repository"
source_directory="$fixture_root/source"
first_restore="$fixture_root/restore-first"
third_restore="$fixture_root/restore-third"
export RESTIC_REPOSITORY="$repository"
export RESTIC_PASSWORD_FILE=/etc/ax-data-archive/secrets/restic-password

mkdir -p "$source_directory"
dd if=/dev/zero of="$source_directory/unchanged.bin" bs=1M count=4 status=none
printf '%s\n' 'version-one' > "$source_directory/changed.txt"
restic init >/dev/null

first_output=$(restic backup --json --compression max "$source_directory")
first_snapshot=$(printf '%s\n' "$first_output" | jq -r 'select(.message_type == "summary") | .snapshot_id')
first_total=$(printf '%s\n' "$first_output" | jq -r 'select(.message_type == "summary") | .total_bytes_processed')

second_output=$(restic backup --json --compression max "$source_directory")
second_snapshot=$(printf '%s\n' "$second_output" | jq -r 'select(.message_type == "summary") | .snapshot_id')
second_added=$(printf '%s\n' "$second_output" | jq -r 'select(.message_type == "summary") | .data_added')

printf '%s\n' 'version-two' > "$source_directory/changed.txt"
third_output=$(restic backup --json --compression max "$source_directory")
third_snapshot=$(printf '%s\n' "$third_output" | jq -r 'select(.message_type == "summary") | .snapshot_id')
third_added=$(printf '%s\n' "$third_output" | jq -r 'select(.message_type == "summary") | .data_added')

restic restore "$first_snapshot" --target "$first_restore" >/dev/null
restic restore "$third_snapshot" --target "$third_restore" >/dev/null
first_changed=$(find "$first_restore" -name changed.txt -type f -print -quit)
third_changed=$(find "$third_restore" -name changed.txt -type f -print -quit)
test "$(sed -n '1p' "$first_changed")" = "version-one"
test "$(sed -n '1p' "$third_changed")" = "version-two"
restic check --read-data >/dev/null

jq -n \
  --argjson firstTotal "$first_total" \
  --argjson secondAdded "$second_added" \
  --argjson thirdAdded "$third_added" \
  --arg firstSnapshot "$first_snapshot" \
  --arg secondSnapshot "$second_snapshot" \
  --arg thirdSnapshot "$third_snapshot" \
  '{
    ok: true,
    unchangedRunAddedLessThanLogical: ($secondAdded < $firstTotal),
    changedRunAddedLessThanLogical: ($thirdAdded < $firstTotal),
    snapshotsIndependentlyRestorable: (
      ($firstSnapshot | length) > 0 and
      ($secondSnapshot | length) > 0 and
      ($thirdSnapshot | length) > 0
    )
  }'
