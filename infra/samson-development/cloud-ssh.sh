#!/bin/bash
# Connect only through the configured Cloud TCP path. No VPN state is installed.
set -euo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
: "${AX_CLOUD_TARGET:?Set the authorized VM IPv4 or hostname}"
: "${AX_CLOUD_KEY_FILE:?Set the runtime owner-only SSH key file}"
: "${AX_CLOUD_KNOWN_HOSTS:?Set the out-of-band-pinned known-hosts file}"
: "${AX_CLOUD_SOCAT:?Set the maintained runtime socat executable}"
policy=${AX_CLOUD_POLICY_FILE:-/etc/codex/network-policy.json}
[[ "$base" =~ ^/[a-zA-Z0-9_./-]+$ ]] || exit 2
python3 "$base/workspace.py" check-tcp --policy "$policy" --target "$AX_CLOUD_TARGET" >/dev/null
python3 "$base/workspace.py" check-key "$AX_CLOUD_KEY_FILE"
test -f "$AX_CLOUD_KNOWN_HOSTS"
test -x "$AX_CLOUD_SOCAT"
# SSH supervises this stdio transport; no shared listener or orphan forward exists.
if [[ "${1-}" == --transport ]]; then
  exec "$AX_CLOUD_SOCAT" STDIO "PROXY:proxy:$AX_CLOUD_TARGET:22,proxyport=8088,resolve=0"
fi
ssh -F /dev/null -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$AX_CLOUD_KNOWN_HOSTS" -o HostKeyAlias=accelerate-dev \
  -o "ProxyCommand=/bin/bash $base/cloud-ssh.sh --transport" \
  -o ConnectTimeout=15 -i "$AX_CLOUD_KEY_FILE" "axdev@$AX_CLOUD_TARGET" "$@"
