#!/bin/bash
# Run as root only inside the dedicated guest. Versions match the Linux lane.
set -euo pipefail
node_version=22.23.3
node_sha=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz" -o "$stage/node.tar.xz"
printf '%s  %s\n' "$node_sha" "$stage/node.tar.xz" | sha256sum --check --status
tar -xJf "$stage/node.tar.xz" -C /opt
for program in node npm npx corepack; do
  ln -sfn "/opt/node-v$node_version-linux-x64/bin/$program" "/usr/local/bin/$program"
done
npm install --global pnpm@10.33.0
ln -sfn "/opt/node-v$node_version-linux-x64/bin/pnpm" /usr/local/bin/pnpm
ln -sfn "/opt/node-v$node_version-linux-x64/bin/pnpx" /usr/local/bin/pnpx
curl -fsSL https://github.com/supabase/cli/releases/download/v2.75.0/supabase_linux_amd64.tar.gz -o "$stage/supabase.tar.gz"
curl -fsSL https://github.com/supabase/cli/releases/download/v2.75.0/supabase_2.75.0_checksums.txt -o "$stage/checksums.txt"
digest=$(awk '$2 == "supabase_linux_amd64.tar.gz" { print $1 }' "$stage/checksums.txt")
[[ "$digest" =~ ^[a-f0-9]{64}$ ]]
printf '%s  %s\n' "$digest" "$stage/supabase.tar.gz" | sha256sum --check --status
tar -xzf "$stage/supabase.tar.gz" -C "$stage" supabase
install -m 0755 "$stage/supabase" /usr/local/bin/supabase
install -d -m 0755 /usr/share/keyrings
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tailscale
systemctl enable --now tailscaled
node_report=$(node --version)
pnpm_report=$(pnpm --version)
supabase_report=$(supabase --version)
tailscale_report=$(tailscale version | head -1)
printf '{"node":"%s","pnpm":"%s","supabase":"%s","tailscale":"%s"}\n' \
  "$node_report" "$pnpm_report" "$supabase_report" "$tailscale_report" \
  > /etc/accelerate-development-toolchain.json
