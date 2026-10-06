#!/usr/bin/env python3
"""Portable file verification and fail-closed remote-development helpers."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import subprocess

ROOT = Path('/srv/accelerate-global')
SKIP = {'node_modules', '.next', '.venv', '__pycache__', '.swc', '.DS_Store', 'fsmonitor--daemon.ipc'}
RECOVERY = {'.gcp', '.vercel', '.tmp', '.temp', '.wrangler', 'output', 'test-results', 'Backups'}


def selected(relative):
    parts = Path(relative).parts
    return not (any(p in SKIP | RECOVERY for p in parts)
                or any(p.startswith('.env') and p != '.env.example' for p in parts)
                or parts[-1].endswith(('.tsbuildinfo', '.journal')))


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def inventory(root):
    root = root.resolve(strict=True)
    result = []
    for parent, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if selected(Path(parent, d).relative_to(root)))
        for name in sorted(files):
            p = Path(parent, name)
            relative = str(p.relative_to(root))
            if not selected(relative):
                continue
            if p.is_symlink() or not p.is_file():
                raise ValueError('Unsupported non-regular transfer member')
            result.append({'path': relative, 'bytes': p.stat().st_size, 'sha256': digest(p)})
        for name in dirs:
            if Path(parent, name).is_symlink():
                raise ValueError('Symlink directories cannot be transferred implicitly')
    return sorted(result, key=lambda entry: entry['path'])


def verify(root, entries):
    root = root.resolve(strict=True)
    seen = set()
    for e in entries:
        relative = Path(e['path'])
        if relative.is_absolute() or '..' in relative.parts or str(relative) in seen:
            raise ValueError('Unsafe or duplicate manifest path')
        seen.add(str(relative))
        p = root / relative
        if p.is_symlink() or root not in p.resolve(strict=True).parents:
            raise ValueError('Manifest member escapes workspace')
        if p.stat().st_size != e['bytes'] or digest(p) != e['sha256']:
            raise ValueError('Transferred file digest mismatch')
    return len(entries)


def private_file(path):
    p = Path(path)
    s = p.lstat()
    if p.is_symlink() or not stat.S_ISREG(s.st_mode) or s.st_mode & 0o077:
        raise ValueError('Credential file must be regular and owner-only')
    if s.st_uid != os.getuid():
        raise ValueError('Credential file is owned by another identity')
    return p


def authorize_tcp(policy, target):
    if policy.get('version') != 1 or policy.get('vpn_configured') is not True:
        raise ValueError('Supported VPN policy is missing')
    grants = policy.get('tcp_network_access')
    if not isinstance(grants, dict):
        raise ValueError('TCP grant snapshot is missing')
    try:
        addr = ipaddress.ip_address(target)
    except ValueError:
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*', target):
            raise ValueError('Invalid destination hostname')
        domains = grants.get('domains', [])
        if any(target.lower() == d.lower() or
               (d.startswith('*.') and target.lower().endswith(d[1:].lower())
                and target.lower() != d[2:].lower()) for d in domains):
            return
        raise ValueError('Destination domain is not granted')
    if addr.version != 4 or not any(addr in ipaddress.ip_network(n) for n in
                                    ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10']):
        raise ValueError('Destination must be private IPv4')
    if any(addr in ipaddress.ip_network(n) for n in grants.get('ip_ranges', [])):
        return
    raise ValueError('Destination IPv4 is not granted')


def task_path(root, task):
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', task):
        raise ValueError('Invalid task identity')
    root = root.resolve(strict=True)
    base = root / 'worktrees'
    base.mkdir(mode=0o700, exist_ok=True)
    if base.is_symlink() or base.resolve().parent != root:
        raise ValueError('Worktree directory escapes workspace')
    path = base / task
    if path.exists() or path.is_symlink():
        raise ValueError('Task worktree already exists')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('inventory'); p.add_argument('--root', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p = sub.add_parser('verify'); p.add_argument('--root', type=Path, required=True)
    p.add_argument('--manifest', type=Path, required=True)
    p = sub.add_parser('check-tcp'); p.add_argument('--policy', type=Path, required=True)
    p.add_argument('--target', required=True)
    p = sub.add_parser('worktree'); p.add_argument('--root', type=Path, default=ROOT)
    p.add_argument('--task', required=True); p.add_argument('--revision', required=True)
    p.add_argument('--repository', choices=['online', 'data'], default='online')
    p = sub.add_parser('check-key'); p.add_argument('path')
    args = parser.parse_args()
    if args.command == 'inventory':
        entries = inventory(args.root)
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(entries, stream, ensure_ascii=False, indent=2)
        print(json.dumps({'files': len(entries), 'bytes': sum(e['bytes'] for e in entries)}))
    elif args.command == 'verify':
        print(json.dumps({'verified_files': verify(args.root, json.loads(args.manifest.read_text()))}))
    elif args.command == 'check-tcp':
        authorize_tcp(json.loads(args.policy.read_text()), args.target)
        print('Authorized private TCP destination')
    elif args.command == 'check-key':
        private_file(args.path)
    else:
        if not re.fullmatch(r'[a-f0-9]{40}', args.revision):
            raise ValueError('An exact full Git commit is required')
        path = task_path(args.root, args.task)
        repo = (args.root / args.repository).resolve(strict=True)
        if repo.parent != args.root.resolve():
            raise ValueError('Repository escapes workspace')
        subprocess.run(['git', '-C', str(repo), 'cat-file', '-e', args.revision + '^{commit}'], check=True)
        subprocess.run(['git', '-C', str(repo), 'worktree', 'add', '--detach', str(path), args.revision], check=True)
        print(json.dumps({'path': str(path), 'revision': args.revision}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
