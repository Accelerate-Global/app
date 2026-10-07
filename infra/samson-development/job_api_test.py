import base64
import concurrent.futures
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import job_api as api

spec = importlib.util.spec_from_file_location('cloud_api', Path(__file__).with_name('cloud-api.py'))
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)
CAP = json.dumps({api.CAPABILITY: [{'role': 'develop'}]})
VPN_POLICY = {'version': 1, 'vpn_configured': True}


class JobApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.heads = {}
        for name in ['online', 'data']:
            repo = self.root / name
            repo.mkdir()
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            for key, value in [('user.name', 'Test'), ('user.email', 'test@example.invalid')]:
                subprocess.run(['git', '-C', str(repo), 'config', key, value], check=True)
            (repo / 'README.md').write_text('original\n')
            subprocess.run(['git', '-C', str(repo), 'add', 'README.md'], check=True)
            subprocess.run(['git', '-C', str(repo), 'commit', '-qm', 'fixture'], check=True)
            self.heads[name] = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
        self.ws = api.Workspace(self.root, self.root / '.cloud-jobs', start_workers=False)
        self.task = self.ws.dispatch('POST', '/v1/tasks', {'task': 'proof', 'repository': 'online', 'revision': self.heads['online']})
        self.worktree = Path(self.task['path'])

    def tearDown(self):
        self.temp.cleanup()

    def assertRejected(self, callback, status=None):
        with self.assertRaises(api.Rejected) as raised:
            callback()
        if status:
            self.assertEqual(raised.exception.status, status)

    def test_task_creation_preserves_canonical_history_and_refuses_existing_or_unknown_commits(self):
        for body in [dict(self.task, task='proof'), {'task': '../escape', 'repository': 'online', 'revision': self.heads['online']},
                     {'task': 'wrong', 'repository': 'other', 'revision': self.heads['online']},
                     {'task': 'missing', 'repository': 'online', 'revision': '0' * 40}]:
            body = {k: v for k, v in body.items() if k in {'task', 'repository', 'revision'}}
            self.assertRejected(lambda body=body: self.ws.dispatch('POST', '/v1/tasks', body))
        self.assertFalse((self.root / 'worktrees/missing').exists())
        self.assertEqual(self.ws.identity()['repositories']['online']['head'], self.heads['online'])
        self.assertEqual((self.worktree / 'README.md').read_text(), 'original\n')

    def test_symlink_worktree_root_and_unknown_non_api_task_are_rejected(self):
        self.assertRejected(lambda: self.ws.task('operator-task'), 404)
        self.assertRejected(lambda: self.ws.task('../proof'))
        self.worktree.rename(self.root / 'moved')
        self.worktree.symlink_to(self.root / 'moved', target_is_directory=True)
        self.assertRejected(lambda: self.ws.task('proof'))

    def test_capability_requires_exact_role_and_supports_serve_q_encoding(self):
        self.assertTrue(api.authorized(CAP))
        encoded = '=?utf-8?q?' + CAP.replace(' ', '=20') + '?='
        self.assertTrue(api.authorized(encoded))
        for value in [None, '', '{}', '[]', 'broken', json.dumps({api.CAPABILITY: ['develop']}),
                      json.dumps({api.CAPABILITY: [{'role': 'admin'}]}), json.dumps({'other/cap': [{'role': 'develop'}]})]:
            self.assertFalse(api.authorized(value))

    def test_secret_cache_and_traversal_paths_are_unavailable(self):
        for value in ['../README.md', '/etc/passwd', 'x//y', './README.md', 'x\\y', '.git/HEAD', '.ENV.local',
                      'node_modules/x', '.gcp/key.json', 'x/private.key', '.codex/config.toml', '.venv/lib/x']:
            self.assertRejected(lambda value=value: api.read_file(self.worktree, value))
        (self.worktree / '.env.example').write_text('PUBLIC=example\n')
        self.assertEqual(base64.b64decode(api.read_file(self.worktree, '.env.example')['base64']), b'PUBLIC=example\n')

    def test_no_follow_blocks_file_and_parent_symlink_escapes(self):
        outside = self.root / 'outside'; outside.mkdir()
        (outside / 'secret').write_text('unavailable')
        (self.worktree / 'link').symlink_to(outside / 'secret')
        (self.worktree / 'directory').symlink_to(outside, target_is_directory=True)
        for value in ['link', 'directory/secret']:
            with self.assertRaises(OSError):
                api.read_file(self.worktree, value)
            with self.assertRaises(OSError):
                api.edit_file(self.worktree, value, b'overwrite', None)
        self.assertEqual((outside / 'secret').read_text(), 'unavailable')

    def test_compare_and_swap_edit_delete_and_range_read(self):
        first = api.read_file(self.worktree, 'README.md', 2, 3)
        self.assertEqual(base64.b64decode(first['base64']), b'igi')
        update = api.edit_file(self.worktree, 'README.md', b'changed\n', first['sha256'])
        self.assertRejected(lambda: api.edit_file(self.worktree, 'README.md', b'lost', first['sha256']), 409)
        self.assertRejected(lambda: api.edit_file(self.worktree, 'README.md', b'lost', None), 409)
        self.assertEqual((self.worktree / 'README.md').read_bytes(), b'changed\n')
        result = api.edit_file(self.worktree, 'README.md', b'', update['sha256'], delete=True)
        self.assertTrue(result['deleted'])
        self.assertFalse((self.worktree / 'README.md').exists())
        self.assertRejected(lambda: api.edit_file(self.worktree, 'README.md', b'', None, delete=True), 409)
        self.assertRejected(lambda: api.read_file(self.worktree, 'x', -1))
        self.assertRejected(lambda: api.edit_file(self.worktree, 'x', b'a' * (api.MAX_WRITE + 1), None), 413)

    def test_unknown_commands_fields_and_cross_repository_checks_never_start(self):
        for body in [{'check': 'shell'}, {'check': 'app:plan', 'command': 'rm -rf /'}, {'check': 'data:unit'}, {'check': 'app:plan', 'env': {'X': 'Y'}}]:
            self.assertRejected(lambda body=body: self.ws.dispatch('POST', '/v1/tasks/proof/checks', body))
        self.assertEqual(list((self.ws.state / 'jobs').glob('*.json')), [])
        self.assertRejected(lambda: self.ws.dispatch('POST', '/v1/execute', {'command': 'true'}), 404)

    def test_staging_uses_literal_paths_and_includes_new_files_in_the_tracked_tree(self):
        api.edit_file(self.worktree, 'route[slug].tsx', b'new source', None)
        api.edit_file(self.worktree, 'routes.tsx', b'other source', None)
        self.ws.dispatch('POST', '/v1/tasks/proof/stage', {'paths': ['route[slug].tsx']})
        staged = subprocess.check_output(['git', '-C', str(self.worktree), 'diff', '--cached', '--name-only'], text=True).splitlines()
        self.assertEqual(staged, ['route[slug].tsx'])
        self.assertIn('new source', self.ws.dispatch('GET', '/v1/tasks/proof/diff')['diff'])

    def test_staging_rejects_directories_credentials_symlinks_and_command_fields(self):
        (self.worktree / 'directory').mkdir()
        (self.worktree / 'link').symlink_to(self.worktree / 'README.md')
        for names in [['directory'], ['.env.local'], ['link'], ['../online/README.md'], []]:
            self.assertRejected(lambda names=names: self.ws.stage('proof', {'paths': names}))
        self.assertRejected(lambda: self.ws.stage('proof', {'paths': ['README.md'], 'command': 'true'}))

    def test_edits_preserve_executable_files_and_allow_only_boolean_mode_changes(self):
        p = self.worktree / 'script.sh'; p.write_bytes(b'original'); p.chmod(0o700)
        old = hashlib.sha256(b'original').hexdigest()
        result = api.edit_file(self.worktree, 'script.sh', b'edited', old)
        self.assertTrue(result['executable'])
        self.assertEqual(p.stat().st_mode & 0o777, 0o700)
        result = api.edit_file(self.worktree, 'script.sh', b'edited', result['sha256'], executable=False)
        self.assertFalse(result['executable'])
        self.assertRejected(lambda: api.edit_file(self.worktree, 'script.sh', b'x', result['sha256'], executable='yes'))

    def test_job_queue_persists_and_restart_marks_interrupted(self):
        result = self.ws.dispatch('POST', '/v1/tasks/proof/checks', {'check': 'app:plan'})
        self.assertEqual(self.ws.job(result['job'])['status'], 'queued')
        self.assertRejected(lambda: self.ws.start_check('proof', {'check': 'app:plan'}), 409)
        fresh = api.Workspace(self.root, self.ws.state, start_workers=False)
        self.assertEqual(fresh.job(result['job'])['status'], 'interrupted')
        self.assertEqual((fresh.state / 'jobs' / (result['job'] + '.json')).stat().st_mode & 0o777, 0o600)

    def test_receipts_are_create_only_bounded_and_reject_credentials(self):
        (self.root / 'docs/Infrastructure').mkdir(parents=True)
        value = self.ws.receipt({'name': 'cloud-task-proof.md', 'content': 'verified'})
        self.assertTrue(Path(value['path']).is_file())
        self.assertRejected(lambda: self.ws.receipt({'name': 'cloud-task-proof.md', 'content': 'replacement'}), 409)
        self.assertRejected(lambda: self.ws.receipt({'name': '../../secret.md', 'content': 'x'}))
        self.assertRejected(lambda: self.ws.receipt({'name': 'cloud-task-secret.md', 'content': 'tskey-auth-fake'}))

    def test_material_namespace_cannot_read_arbitrary_project_roots(self):
        (self.root / 'docs').mkdir(); (self.root / 'docs/report.md').write_text('report')
        result = self.ws.dispatch('GET', '/v1/materials?root=docs&path=report.md')
        self.assertEqual(base64.b64decode(result['base64']), b'report')
        self.assertRejected(lambda: self.ws.dispatch('GET', '/v1/materials?root=online&path=README.md'))
        self.assertRejected(lambda: self.ws.dispatch('GET', '/v1/materials?root=docs&path=../online/README.md'))

    def test_material_listing_excludes_credentials_and_symlinks(self):
        docs = self.root / 'docs'; docs.mkdir()
        (docs / 'report.md').write_text('report')
        (docs / '.env').write_text('hidden')
        (docs / 'outside').symlink_to(self.root / 'online', target_is_directory=True)
        self.assertEqual(self.ws.dispatch('GET', '/v1/materials/files?root=docs')['files'], ['report.md'])

    def test_api_preparation_uses_synthetic_configuration_and_hides_it_from_file_api(self):
        value = (self.worktree / '.env.local').read_text()
        self.assertIn('http://127.0.0.1:54321', value)
        self.assertNotIn('SERVICE_ROLE', value)
        self.assertRejected(lambda: self.ws.dispatch('GET', '/v1/tasks/proof/file?path=.env.local'), 403)

    def test_real_http_rejects_missing_capability_and_serializes_stale_edits(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), api.Handler); server.workspace = self.ws
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        origin = f'http://127.0.0.1:{server.server_port}'
        try:
            with self.assertRaises(urllib.error.HTTPError) as denied:
                opener.open(origin + '/v1/identity')
            self.assertEqual(denied.exception.code, 403)
            denied.exception.close()
            original = api.read_file(self.worktree, 'README.md')['sha256']
            def write(text):
                req = urllib.request.Request(origin + '/v1/tasks/proof/file', method='POST', data=json.dumps({'path': 'README.md', 'base64': base64.b64encode(text.encode()).decode(), 'expected_sha256': original}).encode(), headers={'Content-Type': 'application/json', 'Tailscale-App-Capabilities': CAP})
                try:
                    with opener.open(req) as r: return r.status
                except urllib.error.HTTPError as e:
                    code = e.code
                    e.close()
                    return code
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                codes = list(pool.map(write, ['one', 'two']))
            self.assertEqual(sorted(codes), [200, 409])
            self.assertIn((self.worktree / 'README.md').read_text(), ['one', 'two'])
        finally:
            server.shutdown(); server.server_close(); thread.join()


class CloudClientTests(unittest.TestCase):
    def test_exact_https_origin_and_redirect_boundary(self):
        self.assertEqual(client.endpoint('https://' + client.API_HOST + '/'), 'https://' + client.API_HOST)
        for value in ['http://' + client.API_HOST, 'https://example.com', 'https://' + client.API_HOST + ':8443', 'https://secret@' + client.API_HOST, 'https://' + client.API_HOST + '/other']:
            with self.assertRaises(ValueError): client.endpoint(value)
        with self.assertRaises(ValueError): client.NoRedirect().redirect_request(None, None, None, None, None, None)
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, 'proxy is required'):
                client.request('https://' + client.API_HOST, 'GET', '/v1/identity')

    def test_unsupported_or_unconfigured_vpn_policy_fails_before_transport(self):
        with patch.dict(os.environ, {'HTTPS_PROXY': 'http://proxy:8080'}, clear=True):
            for policy in [{}, {'version': 2, 'vpn_configured': True}, {'version': 1, 'vpn_configured': False}]:
                with self.assertRaisesRegex(ValueError, 'runtime policy is required'):
                    client.request('https://' + client.API_HOST, 'GET', '/v1/identity', policy=policy)

    def test_inherited_proxy_is_used_even_with_no_proxy_wildcard(self):
        seen = []
        class DenyProxy(api.BaseHTTPRequestHandler):
            def do_CONNECT(self):
                seen.append(self.path); self.send_error(403)
            def log_message(self, *_): pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), DenyProxy)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with patch.dict(os.environ, {'HTTPS_PROXY': f'http://127.0.0.1:{server.server_port}', 'NO_PROXY': '*'}, clear=True):
                with self.assertRaises(urllib.error.URLError):
                    client.request('https://' + client.API_HOST, 'GET', '/v1/identity', policy=VPN_POLICY)
            self.assertEqual(seen, [client.API_HOST + ':443'])
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
