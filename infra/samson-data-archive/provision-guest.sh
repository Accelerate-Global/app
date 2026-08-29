#!/bin/sh
set -eu

export DEBIAN_FRONTEND=noninteractive
source_root=/opt/ax-data-archive-source
infra_root="$source_root/infra/samson-data-archive"
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg
install -d -m 0755 /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl jq nftables postgresql-client-17 restic rclone xz-utils zstd

node_version=22.23.2
node_sha256=d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307
node_archive="/tmp/node-v${node_version}-linux-x64.tar.xz"
curl -fsSL --retry 3 \
  "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-x64.tar.xz" \
  -o "$node_archive"
echo "$node_sha256  $node_archive" | sha256sum --check --status
tar -xJf "$node_archive" -C /opt
ln -sfn "/opt/node-v${node_version}-linux-x64/bin/node" /usr/local/bin/node
ln -sfn "/opt/node-v${node_version}-linux-x64/bin/npm" /usr/local/bin/npm
ln -sfn "/opt/node-v${node_version}-linux-x64/bin/npx" /usr/local/bin/npx
ln -sfn "/opt/node-v${node_version}-linux-x64/bin/corepack" /usr/local/bin/corepack

supabase_version=2.109.1
supabase_sha256=75de33f90ca53586208317231a7ba7bd8319714fe7b68578c617f152ca8b3c6d
supabase_deb=/tmp/supabase.deb
curl -fsSL --retry 3 \
  "https://github.com/supabase/cli/releases/download/v${supabase_version}/supabase_${supabase_version}_linux_amd64.deb" \
  -o "$supabase_deb"
echo "$supabase_sha256  $supabase_deb" | sha256sum --check --status
dpkg -i "$supabase_deb"
apt-mark hold postgresql-client-17 restic rclone supabase

if ! id axarchive >/dev/null 2>&1; then
  useradd --system --uid 1100 --home-dir /var/lib/ax-data-archive \
    --create-home --shell /usr/sbin/nologin axarchive
fi

install -d -o axarchive -g axarchive -m 0700 \
  /var/lib/ax-data-archive \
  /var/cache/ax-data-archive \
  /srv/ax-data-archive/current \
  /srv/ax-data-archive/restic
install -d -o root -g axarchive -m 0710 /etc/ax-data-archive /etc/ax-data-archive/secrets
install -d -o root -g root -m 0755 /opt/ax-data-archive

install -o root -g root -m 0644 "$infra_root/worker-package.json" \
  /opt/ax-data-archive/package.json
install -o root -g root -m 0644 "$source_root/tsconfig.json" \
  /opt/ax-data-archive/tsconfig.json
cp -a "$source_root/src" /opt/ax-data-archive/
cp -a "$source_root/scripts" /opt/ax-data-archive/
cp -a "$source_root/supabase" /opt/ax-data-archive/
chown -R root:root /opt/ax-data-archive
npm --prefix /opt/ax-data-archive install --omit=dev --ignore-scripts

install -o root -g root -m 0644 "$infra_root/ax-data-archive.service" \
  /etc/systemd/system/ax-data-archive.service
install -o root -g root -m 0644 "$infra_root/ax-data-archive.timer" \
  /etc/systemd/system/ax-data-archive.timer
install -o root -g root -m 0644 "$infra_root/ax-data-archive-missed.service" \
  /etc/systemd/system/ax-data-archive-missed.service
install -o root -g root -m 0644 "$infra_root/ax-data-archive-missed.timer" \
  /etc/systemd/system/ax-data-archive-missed.timer
install -o root -g root -m 0644 "$infra_root/nftables.conf" \
  /etc/nftables.conf
install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d
install -o root -g root -m 0644 "$infra_root/journald.conf" \
  /etc/systemd/journald.conf.d/ax-data-archive.conf
install -o root -g root -m 0644 "$infra_root/supabase-root-2021.crt" \
  /etc/ax-data-archive/supabase-root-2021.crt

{
  printf 'nodejs-official\t%s\n' "$(/usr/local/bin/node --version)"
  printf 'npm-official\t%s\n' "$(/usr/local/bin/npm --version)"
  dpkg-query -W -f='${Package}\t${Version}\n' \
    postgresql-client-17 restic rclone supabase
} > /opt/ax-data-archive/toolchain.lock

systemctl daemon-reload
systemctl enable --now nftables
systemctl restart systemd-journald
systemctl disable --now ssh.service ssh.socket >/dev/null 2>&1 || true
systemctl mask ssh.service ssh.socket >/dev/null 2>&1 || true
systemctl disable proxmox-regenerate-snakeoil.service >/dev/null 2>&1 || true
systemctl reset-failed proxmox-regenerate-snakeoil.service >/dev/null 2>&1 || true
systemctl disable ax-data-archive.timer ax-data-archive-missed.timer >/dev/null 2>&1 || true
