"""Negative boundary tests; no network, credentials or real infrastructure."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('workspace', Path(__file__).with_name('workspace.py'))
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)


class WorkspaceTests(unittest.TestCase):
    def test_manifest_detects_corruption_and_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'source.txt').write_text('original')
            entries = w.inventory(root)
            self.assertEqual(w.verify(root, entries), 1)
            (root / 'source.txt').write_text('tampered')
            with self.assertRaises(ValueError): w.verify(root, entries)
            with self.assertRaises(ValueError): w.verify(root, [{'path': '../outside', 'bytes': 0}])

    def test_credentials_and_caches_excluded_but_sources_retained(self):
        for name in ['data/.env', 'online/.env.local', '.gcp/key.json', 'docs/Backups/file', 'online/node_modules/x', 'online/.tmp/cookies', 'online/supabase/.temp/project-ref']:
            self.assertFalse(w.selected(name), name)
        for name in ['online/.env.example', 'data/.git/refs/heads/local', 'docs/reference.pdf']:
            self.assertTrue(w.selected(name), name)

    def test_symlink_escape_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'escape').symlink_to('/tmp', target_is_directory=True)
            with self.assertRaises(ValueError): w.inventory(root)

    def test_exact_ipv4_and_domain_grants_fail_closed(self):
        policy = {'version': 1, 'vpn_configured': True,
                  'tcp_network_access': {'ip_ranges': ['100.100.1.2/32'], 'domains': ['*.example.internal']}}
        w.authorize_tcp(policy, '100.100.1.2'); w.authorize_tcp(policy, 'dev.example.internal')
        for host in ['100.100.1.3', '8.8.8.8', 'example.internal', 'evil.example.internal.attacker.com', '-option']:
            with self.assertRaises(ValueError): w.authorize_tcp(policy, host)
        for invalid in [{}, {'version': 2, 'vpn_configured': True}, {**policy, 'vpn_configured': False}]:
            with self.assertRaises(ValueError): w.authorize_tcp(invalid, '100.100.1.2')

    def test_existing_task_and_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); p = w.task_path(root, 'task-1'); p.mkdir()
            for task in ['task-1', '../other', '/absolute', 'a;command']:
                with self.assertRaises(ValueError): w.task_path(root, task)

    def test_exposed_key_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / 'key'; key.write_text('test-only')
            key.chmod(0o600); w.private_file(key)
            key.chmod(0o644)
            with self.assertRaises(ValueError): w.private_file(key)


if __name__ == '__main__': unittest.main()
