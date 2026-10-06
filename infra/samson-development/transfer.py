#!/usr/bin/env python3
"""Transfer an explicit verified tar manifest over pinned SSH; never delete source."""
import argparse
import ipaddress
import json
from pathlib import Path
import subprocess
import tempfile
import workspace


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True); p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--host', required=True); p.add_argument('--key', required=True)
    p.add_argument('--known-hosts', type=Path, required=True); p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    target = ipaddress.ip_address(a.host)
    if target.version != 4 or target not in ipaddress.ip_network('192.168.88.0/24'):
        raise ValueError('Transfer destination must be the approved Samson LAN guest')
    workspace.private_file(a.key)
    if not a.known_hosts.is_file(): raise ValueError('Pinned known-hosts file missing')
    entries = json.loads(a.manifest.read_text()); workspace.verify(a.source, entries)
    if any(not workspace.selected(e['path']) for e in entries): raise ValueError('Manifest includes recovery-only material')
    with tempfile.TemporaryDirectory() as directory:
        listing = Path(directory) / 'files'
        listing.write_bytes(b''.join(e['path'].encode() + b'\0' for e in entries))
        transport = ['ssh', '-F', '/dev/null', '-i', a.key, '-o', 'BatchMode=yes',
                     '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
                     '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
                     '-o', 'UserKnownHostsFile=' + str(a.known_hosts), 'axops@' + str(target)]
        subprocess.run(transport + ['sudo -n -u axdev test -d /srv/accelerate-global'], check=True, timeout=45)
        if a.apply:
            # Stdio streaming avoids Apple's openrsync protocol-29 manifest deadlock.
            with tempfile.TemporaryFile() as errors:
                archive = subprocess.Popen(['tar', '-C', str(a.source.resolve()), '--null', '-T', str(listing),
                                            '-czf', '-'], stdout=subprocess.PIPE, stderr=errors,
                                           env={**__import__('os').environ, 'COPYFILE_DISABLE': '1'})
                receiver = subprocess.Popen(transport + ['umask 077; sudo -n -u axdev tar --no-same-owner -xzf - -C /srv/accelerate-global'],
                                            stdin=archive.stdout, stderr=errors)
                archive.stdout.close()
                received = receiver.wait(); produced = archive.wait()
                if received or produced:
                    raise RuntimeError('Private transfer failed; inspect destination before retrying')
    print(json.dumps({'apply': a.apply, 'manifest_files': len(entries)}))


if __name__ == '__main__': main()
