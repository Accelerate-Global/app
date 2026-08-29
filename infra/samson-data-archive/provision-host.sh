#!/bin/sh
set -eu

guest_id=104
dataset=samson-backup/ax-online-archive
mountpoint=/srv/ax-data-archive
template=local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst

if ! zfs list -H -o name "$dataset" >/dev/null 2>&1; then
  zfs create \
    -o mountpoint="$mountpoint" \
    -o compression=zstd \
    -o atime=off \
    -o xattr=sa \
    -o acltype=posixacl \
    -o setuid=off \
    -o quota=50G \
    "$dataset"
fi

zfs set compression=zstd atime=off xattr=sa acltype=posixacl setuid=off quota=50G "$dataset"

if ! pveam list local | awk '{print $1}' | grep -Fx "$template" >/dev/null 2>&1; then
  pveam update
  pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst
fi

if ! pct status "$guest_id" >/dev/null 2>&1; then
  pct create "$guest_id" "$template" \
    --hostname ax-data-archive \
    --unprivileged 1 \
    --rootfs local-lvm:16 \
    --cores 2 \
    --memory 2048 \
    --swap 512 \
    --net0 name=eth0,bridge=vmbr0,ip=dhcp,firewall=1,type=veth \
    --mp0 "$mountpoint",mp=/srv/ax-data-archive,backup=0 \
    --onboot 1 \
    --startup order=30,up=30,down=60 \
    --features nesting=0,keyctl=0 \
    --timezone host
fi

pct set "$guest_id" --description "AX Online single-site Supabase recovery archive. No public listener."
pct start "$guest_id" || true
