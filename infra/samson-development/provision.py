#!/usr/bin/env python3
"""Run on Samson: inspect, then create only a fresh dedicated development guest."""
import argparse
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import subprocess


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


def public_key(path):
    key = Path(path).read_text().strip()
    if not re.fullmatch(r'ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\n]+)?', key):
        raise ValueError('Expected one Ed25519 public key')
    return key


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args(); c = json.loads(args.config.read_text())
    vm = str(c['vmid'])
    if not re.fullmatch(r'[1-9][0-9]{2,5}', vm) or c['hostname'] != 'accelerate-dev':
        raise ValueError('Unexpected guest identity')
    if c['bridge'] != 'vmbr0' or c['gateway'] != '192.168.88.1':
        raise ValueError('Unsupported network boundary')
    ip = ipaddress.ip_interface(c['address'])
    if ip.ip not in ipaddress.ip_network('192.168.88.0/24'):
        raise ValueError('Unexpected guest address')
    if not re.fullmatch(r'(?:[0-9A-F]{2}:){5}[0-9A-F]{2}', c['mac']):
        raise ValueError('Invalid MAC')
    nodes = json.loads(run('pvesh', 'get', '/nodes', '--output-format', 'json'))
    if not any(n['node'] == 'Samson' for n in nodes): raise ValueError('Wrong hypervisor')
    guests = json.loads(run('pvesh', 'get', '/cluster/resources', '--output-format', 'json'))
    if any(str(g.get('vmid')) == vm or g.get('name') == c['hostname'] for g in guests):
        raise ValueError('Guest identity already allocated; inspect before resuming')
    memory = json.loads(run('pvesh', 'get', '/nodes/Samson/status', '--output-format', 'json'))['memory']
    if memory['available'] < 32 * 1024 ** 3: raise ValueError('Insufficient memory reserve')
    storage = json.loads(run('pvesh', 'get', '/nodes/Samson/storage/local-lvm/status', '--output-format', 'json'))
    if storage['avail'] < 160 * 1024 ** 3: raise ValueError('Insufficient disk reserve')
    image = Path(c['image_path'])
    with image.open('rb') as f: actual = hashlib.file_digest(f, 'sha256').hexdigest()
    if actual != c['image_sha256']: raise ValueError('Cloud image checksum mismatch')
    operator = public_key(c['operator_public_key'])
    cloud = public_key(c['cloud_public_key'])
    install = Path(c['install_script']).read_text()
    userdata = {
        'hostname': c['hostname'], 'manage_etc_hosts': True,
        'ssh_pwauth': False, 'disable_root': True, 'groups': ['docker'],
        'users': [
            {'name': 'axops', 'lock_passwd': True, 'groups': ['adm', 'sudo'],
             'sudo': 'ALL=(ALL) NOPASSWD:ALL', 'shell': '/bin/bash', 'ssh_authorized_keys': [operator]},
            {'name': 'axdev', 'lock_passwd': True, 'groups': ['docker'],
             'shell': '/bin/bash', 'ssh_authorized_keys': [cloud]}],
        'package_update': True,
        'packages': ['qemu-guest-agent', 'docker.io', 'ca-certificates', 'curl', 'git', 'jq',
                     'python3', 'python3-venv', 'python3-pip', 'rsync', 'ripgrep', 'xz-utils', 'unzip', 'nftables', 'socat'],
        'write_files': [
            {'path': '/usr/local/sbin/ax-install-tools', 'permissions': '0750', 'content': install},
            {'path': '/etc/ssh/sshd_config.d/00-ax-security.conf', 'permissions': '0644',
             'content': 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\nAllowUsers axops axdev\nAllowAgentForwarding no\nAllowTcpForwarding no\nX11Forwarding no\n'},
            {'path': '/etc/sysctl.d/60-ax-ipv6.conf', 'permissions': '0644',
             'content': 'net.ipv6.conf.all.disable_ipv6=1\nnet.ipv6.conf.default.disable_ipv6=1\n'},
            {'path': '/etc/systemd/journald.conf.d/ax-limits.conf', 'permissions': '0644',
             'content': '[Journal]\nSystemMaxUse=128M\nRuntimeMaxUse=32M\n'}],
        'runcmd': [['systemctl', 'enable', '--now', 'qemu-guest-agent'],
                   ['systemctl', 'enable', '--now', 'docker'], ['sysctl', '--system'],
                   ['install', '-d', '-m', '0700', '-o', 'axdev', '-g', 'axdev', '/srv/accelerate-global'],
                   ['systemctl', 'restart', 'ssh'], ['/usr/local/sbin/ax-install-tools']]}
    rules = '''[OPTIONS]
enable: 1
policy_in: DROP
policy_out: DROP
dhcp: 1
ndp: 0
radv: 0
macfilter: 1

[IPSET ipfilter-net0]
''' + str(ip.ip) + '''

[RULES]
IN ACCEPT -i net0 -source 192.168.88.241/32 -p tcp -dport 22
IN ACCEPT -i net0 -source 192.168.88.1/32 -p tcp -dport 22
IN ACCEPT -i net0 -p udp -dport 41641
OUT ACCEPT -i net0 -dest 192.168.88.1/32 -p udp -dport 53
OUT ACCEPT -i net0 -dest 192.168.88.1/32 -p tcp -dport 53
OUT DROP -i net0 -dest 10.0.0.0/8
OUT DROP -i net0 -dest 172.16.0.0/12
OUT DROP -i net0 -dest 192.168.0.0/16
OUT DROP -i net0 -dest 100.64.0.0/10
OUT DROP -i net0 -dest 169.254.0.0/16
OUT DROP -i net0 -dest 224.0.0.0/4
OUT ACCEPT -i net0 -dest 0.0.0.0/0
'''
    print(json.dumps({'vmid': vm, 'name': c['hostname'], 'address': str(ip), 'apply': args.apply,
                      'resources': {'vcpus': 4, 'memory_gib': 16, 'disk_gib': 128}}), flush=True)
    if not args.apply: return
    firewall = Path('/etc/pve/firewall') / (vm + '.fw')
    snippet = Path('/var/lib/vz/snippets') / ('accelerate-dev-' + vm + '.yaml')
    if firewall.exists() or snippet.exists(): raise ValueError('Target configuration already exists')
    run('qm', 'create', vm, '--name', c['hostname'], '--cores', '4', '--memory', '16384',
        '--balloon', '8192', '--cpu', 'host', '--ostype', 'l26', '--agent', 'enabled=1',
        '--scsihw', 'virtio-scsi-single', '--net0', 'virtio=' + c['mac'] + ',bridge=vmbr0,link_down=1,firewall=1',
        '--serial0', 'socket', '--vga', 'serial0', '--onboot', '0', '--ide2', 'local-lvm:cloudinit',
        '--ipconfig0', 'ip=' + str(ip) + ',gw=' + c['gateway'], '--nameserver', '192.168.88.1',
        '--tags', 'accelerate-development')
    run('qm', 'set', vm, '--scsi0', 'local-lvm:0,import-from=' + str(image) + ',discard=on,iothread=1,ssd=1')
    run('qm', 'resize', vm, 'scsi0', '128G'); run('qm', 'set', vm, '--boot', 'order=scsi0')
    firewall.write_text(rules)
    if not Path('/etc/pve/firewall/cluster.fw').is_file() or 'enable: 1' not in Path('/etc/pve/firewall/cluster.fw').read_text():
        raise ValueError('Cluster guest firewall is not enabled; keep NIC disconnected')
    run('pve-firewall', 'compile')
    snippet.parent.mkdir(exist_ok=True)
    snippet.write_text('#cloud-config\n' + json.dumps(userdata, indent=2) + '\n')
    run('qm', 'set', vm, '--cicustom', 'user=local:snippets/' + snippet.name)
    run('qm', 'set', vm, '--net0', 'virtio=' + c['mac'] + ',bridge=vmbr0,firewall=1')
    run('qm', 'start', vm)
    print(json.dumps({'started': vm, 'firewall': 'compiled', 'first_boot': 'pending'}), flush=True)


if __name__ == '__main__': main()
