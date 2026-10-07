#!/usr/bin/env python3
"""Private, capability-authenticated development operations for the Samson VM."""
import argparse
import base64
import binascii
import email.header
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import socket
import stat
import subprocess
import threading
import time
from urllib.parse import parse_qs, urlsplit
import uuid

CAPABILITY = 'accelerate.local/cap/develop'
MAX_BODY = 4 * 1024 * 1024
MAX_WRITE = 2 * 1024 * 1024
MAX_READ = 256 * 1024
MAX_LOG = 32 * 1024 * 1024
TASK_RE = re.compile(r'[a-z0-9][a-z0-9_-]{0,63}')
SHA_RE = re.compile(r'[a-f0-9]{64}')
BLOCKED = {'.git', '.codex', '.gcp', '.ssh', '.aws', '.kube', '.docker', '.netrc',
           '.venv', 'node_modules', '.next', '.tmp', '.temp', '.vercel', '.wrangler',
           '__pycache__', 'backups', '.cloud-jobs'}
CHECKS = {
    'helpers:test': ('online', ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'infra/samson-development', '-p', '*_test.py', '-v']),
    'app:plan': ('online', ['pnpm', 'run', 'verify:change']),
    'app:typecheck': ('online', ['pnpm', 'run', 'typecheck']),
    'app:fast': ('online', ['pnpm', 'run', 'verify:fast']),
    'app:verify': ('online', ['pnpm', 'run', 'verify:change:run']),
    'app:install': ('online', ['pnpm', 'install', '--frozen-lockfile']),
    'data:unit': ('data', ['python', '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-v']),
}


class Rejected(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def authorized(value):
    try:
        decoded = ''.join(part.decode(charset or 'utf-8') if isinstance(part, bytes) else part
                          for part, charset in email.header.decode_header(value or ''))
        caps = json.loads(decoded)
        roles = caps.get(CAPABILITY) if isinstance(caps, dict) else None
        return isinstance(roles, list) and any(isinstance(r, dict) and r.get('role') == 'develop' for r in roles)
    except (ValueError, UnicodeError, LookupError):
        return False


def fields(body, required, optional=()):
    if not isinstance(body, dict) or set(body) - set(required) - set(optional) or set(required) - set(body):
        raise Rejected('Invalid request fields')


def safe_parts(value):
    if not isinstance(value, str) or not value or len(value) > 1024 or '\\' in value or '\x00' in value:
        raise Rejected('Invalid relative file path')
    parts = value.split('/')
    if any(p in {'', '.', '..'} for p in parts):
        raise Rejected('Unsafe relative file path')
    for part in parts:
        lower = part.lower()
        if lower in BLOCKED or (lower.startswith('.env') and lower != '.env.example') or lower.endswith(('.key', '.age', '.pem', '.tsbuildinfo')):
            raise Rejected('Credential, cache or control path is unavailable', 403)
    return parts


def parent_fd(root, value, create=False):
    parts = safe_parts(value)
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            try:
                next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            except FileNotFoundError:
                if not create:
                    raise
                os.mkdir(part, 0o700, dir_fd=fd)
                next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd, parts[-1]
    except BaseException:
        os.close(fd)
        raise


def read_file(root, value, offset=0, length=MAX_READ):
    if type(offset) is not int or offset < 0 or type(length) is not int or not 1 <= length <= MAX_READ:
        raise Rejected('Invalid read range')
    parent, name = parent_fd(root, value)
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode):
                raise Rejected('Only regular files are available')
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            stream.seek(offset)
            content = stream.read(length)
        return {'path': value, 'bytes': info.st_size, 'sha256': digest, 'offset': offset,
                'base64': base64.b64encode(content).decode(), 'next_offset': offset + len(content)}
    finally:
        os.close(parent)


def edit_file(root, value, content, expected, delete=False, executable=None):
    if expected is not None and (not isinstance(expected, str) or not SHA_RE.fullmatch(expected)):
        raise Rejected('An expected SHA256 or null is required')
    if len(content) > MAX_WRITE:
        raise Rejected('File write exceeds limit', 413)
    if executable is not None and type(executable) is not bool:
        raise Rejected('Executable must be a boolean')
    parent, name = parent_fd(root, value, create=not delete and expected is None)
    temporary = '.ax-edit-' + uuid.uuid4().hex
    previous_executable = False
    try:
        try:
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
            with os.fdopen(fd, 'rb') as stream:
                info = os.fstat(stream.fileno())
                if not stat.S_ISREG(info.st_mode):
                    raise Rejected('Only regular files may be edited')
                previous_executable = bool(info.st_mode & 0o111)
                actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        except FileNotFoundError:
            actual = None
        if actual != expected or (delete and actual is None):
            raise Rejected('File changed or is missing', 409)
        if delete:
            os.unlink(name, dir_fd=parent)
            return {'path': value, 'deleted': True}
        mode = 0o700 if (previous_executable if executable is None else executable) else 0o600
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=parent)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
        return {'path': value, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content), 'executable': bool(mode & 0o100)}
    finally:
        try:
            os.unlink(temporary, dir_fd=parent)
        except FileNotFoundError:
            pass
        os.close(parent)


def run(args, cwd=None, timeout=60):
    result = subprocess.run(args, cwd=cwd, capture_output=True, timeout=timeout)
    if result.returncode:
        raise Rejected('Operation failed; no external command arguments are accepted', 422)
    return result.stdout.decode('utf-8', 'replace')


class Workspace:
    def __init__(self, root, state, start_workers=True):
        self.root = Path(root).resolve(strict=True)
        self.state = Path(state)
        if self.state.is_symlink():
            raise Rejected('State directory cannot be a symlink')
        self.state.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.state = self.state.resolve()
        self.state.chmod(0o700)
        for name in ['tasks', 'jobs', 'cache']:
            p = self.state / name
            if p.is_symlink():
                raise Rejected('State child cannot be a symlink')
            p.mkdir(mode=0o700, exist_ok=True)
        self.lock = threading.RLock()
        self.job_lock = threading.Lock()
        self.start_workers = start_workers
        # An interrupted daemon never reports an old running job as healthy.
        for p in (self.state / 'jobs').glob('*.json'):
            record = json.loads(p.read_text())
            if record.get('status') in {'running', 'queued'}:
                record.update(status='interrupted', finished=time.time())
                self.save(p, record)

    @staticmethod
    def save(path, record):
        tmp = path.with_name(path.name + '.' + uuid.uuid4().hex)
        with tmp.open('x') as stream:
            os.chmod(tmp, 0o600)
            json.dump(record, stream)
        tmp.replace(path)

    def repository(self, name):
        if name not in {'online', 'data'}:
            raise Rejected('Unknown repository')
        p = self.root / name
        if p.is_symlink() or p.resolve(strict=True).parent != self.root:
            raise Rejected('Repository escapes project')
        return p

    def task(self, name):
        if not isinstance(name, str) or not TASK_RE.fullmatch(name):
            raise Rejected('Invalid task ID')
        record_path = self.state / 'tasks' / (name + '.json')
        if not record_path.is_file() or record_path.is_symlink():
            raise Rejected('Unknown API-owned task', 404)
        record = json.loads(record_path.read_text())
        base = self.root / 'worktrees'
        path = base / name
        if base.is_symlink() or path.is_symlink() or path.resolve(strict=True) != self.root / 'worktrees' / name:
            raise Rejected('Task path escapes workspace')
        repo = self.repository(record['repository'])
        common = Path(run(['git', '-C', str(path), 'rev-parse', '--git-common-dir']).strip())
        if not common.is_absolute():
            common = path / common
        if common.resolve() != (repo / '.git').resolve():
            raise Rejected('Task Git identity mismatch')
        return record, path

    def identity(self):
        return {'version': 1, 'hostname': socket.gethostname(), 'root': str(self.root),
                'capability': CAPABILITY, 'repositories': {
                    name: {'head': run(['git', '-C', str(self.repository(name)), 'rev-parse', 'HEAD']).strip()}
                    for name in ['online', 'data']}, 'checks': sorted(CHECKS)}

    def create_task(self, body):
        fields(body, ['task', 'repository', 'revision'])
        name, revision = body['task'], body['revision']
        if not isinstance(name, str) or not TASK_RE.fullmatch(name) or not isinstance(revision, str) or not re.fullmatch(r'[a-f0-9]{40}', revision):
            raise Rejected('Unique task ID and exact commit required')
        repo = self.repository(body['repository'])
        base = self.root / 'worktrees'
        if base.is_symlink():
            raise Rejected('Worktree root is a symlink')
        base.mkdir(mode=0o700, exist_ok=True)
        path = base / name
        record_path = self.state / 'tasks' / (name + '.json')
        if path.exists() or path.is_symlink() or record_path.exists():
            raise Rejected('Task already exists', 409)
        run(['git', '-C', str(repo), 'cat-file', '-e', revision + '^{commit}'])
        run(['git', '-C', str(repo), 'worktree', 'add', '--detach', str(path), revision])
        record = {'task': name, 'repository': body['repository'], 'revision': revision, 'path': str(path), 'created': time.time()}
        self.save(record_path, record)
        if body['repository'] == 'online' and (repo / 'node_modules').is_dir():
            (path / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
        if body['repository'] == 'online':
            # Fresh tasks receive synthetic local configuration, never a copied
            # provider credential file or production project link.
            config = path / '.env.local'
            if not config.exists():
                config.write_text('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n'
                                  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_samson_dev_placeholder\n'
                                  'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres\n'
                                  'SUPABASE_BUCKET=datasets\n')
                config.chmod(0o600)
        return record

    def files(self, path, offset):
        if type(offset) is not int or offset < 0:
            raise Rejected('Invalid listing offset')
        raw = run(['git', '-C', str(path), 'ls-files', '--cached', '--others', '--exclude-standard', '-z'])
        files = []
        for name in sorted(set(raw.split('\0')) - {''}):
            try:
                safe_parts(name)
            except Rejected:
                continue
            files.append(name)
        return {'files': files[offset:offset + 200], 'total': len(files), 'next_offset': min(offset + 200, len(files))}

    def job(self, name):
        if not re.fullmatch(r'[a-f0-9]{32}', name):
            raise Rejected('Invalid job ID')
        p = self.state / 'jobs' / (name + '.json')
        if not p.is_file() or p.is_symlink():
            raise Rejected('Unknown job', 404)
        record = json.loads(p.read_text())
        log = self.state / 'jobs' / (name + '.log')
        tail = b''
        if log.is_file() and not log.is_symlink():
            with log.open('rb') as stream:
                stream.seek(max(0, log.stat().st_size - MAX_READ))
                tail = stream.read(MAX_READ)
        return {**record, 'log_tail': tail.decode('utf-8', 'replace')}

    def start_check(self, task, body):
        fields(body, ['check'])
        record, path = self.task(task)
        check = body['check']
        if not isinstance(check, str) or check not in CHECKS or CHECKS[check][0] != record['repository']:
            raise Rejected('Unknown check for this repository')
        pending = [p for p in (self.state / 'jobs').glob('*.json') if json.loads(p.read_text()).get('status') in {'running', 'queued'}]
        if pending:
            raise Rejected('Another verification job is active', 409)
        name = uuid.uuid4().hex
        job = {'job': name, 'task': task, 'check': check, 'status': 'queued', 'created': time.time()}
        self.save(self.state / 'jobs' / (name + '.json'), job)
        if self.start_workers:
            threading.Thread(target=self.worker, args=(job, path), daemon=True).start()
        return job

    def stage(self, task, body):
        fields(body, ['paths'])
        _, path = self.task(task)
        names = body['paths']
        if not isinstance(names, list) or not 1 <= len(names) <= 200:
            raise Rejected('Provide a bounded list of exact file paths')
        for name in names:
            parent, leaf = parent_fd(path, name)
            try:
                try:
                    info = os.stat(leaf, dir_fd=parent, follow_symlinks=False)
                    if not stat.S_ISREG(info.st_mode):
                        raise Rejected('Only individual regular files can be staged')
                except FileNotFoundError:
                    run(['git', '--literal-pathspecs', '-C', str(path), 'ls-files', '--error-unmatch', '--', name])
            finally:
                os.close(parent)
        run(['git', '--literal-pathspecs', '-C', str(path), 'add', '--', *names])
        return {'task': task, 'staged': names}

    def worker(self, job, path):
        name = job['job']
        out = self.state / 'jobs' / (name + '.json')
        log = self.state / 'jobs' / (name + '.log')
        with self.job_lock:
            job.update(status='running', started=time.time())
            self.save(out, job)
            command = list(CHECKS[job['check']][1])
            if command[0] == 'python':
                command[0] = str(self.repository('data') / '.venv/bin/python')
            if job['check'] == 'app:verify':
                command = ['bash', str(Path(__file__).with_name('verify-task.sh')), str(path)]
            if job['check'] == 'app:install' and (path / 'node_modules').is_symlink():
                if (path / 'node_modules').resolve() != (self.repository('online') / 'node_modules').resolve():
                    job.update(status='failed', error='Unexpected dependency link', finished=time.time())
                    self.save(out, job)
                    return
                (path / 'node_modules').unlink()
            if job['check'] == 'app:install':
                command += ['--store-dir', str(self.state / 'cache' / 'pnpm')]
            command = ['flock', '-w', '60', str(self.root / '.verification.lock'), *command]
            env = os.environ.copy()
            env.update(XDG_CACHE_HOME=str(self.state / 'cache'), NPM_CONFIG_CACHE=str(self.state / 'cache' / 'npm'),
                       DRIVE_UPLOAD='0', PYTHONDONTWRITEBYTECODE='1', OPENSPEC_TELEMETRY='0')
            process = None
            try:
                with log.open('xb') as output:
                    os.chmod(log, 0o600)
                    process = subprocess.Popen(command, cwd=path, env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
                    deadline = time.monotonic() + 7200
                    while process.poll() is None:
                        if time.monotonic() >= deadline or log.stat().st_size > MAX_LOG:
                            os.killpg(process.pid, signal.SIGTERM)
                            job['termination'] = 'time or output limit'
                            try:
                                process.wait(timeout=15)
                            except subprocess.TimeoutExpired:
                                os.killpg(process.pid, signal.SIGKILL)
                            break
                        time.sleep(0.25)
                    code = process.wait()
                job.update(status='passed' if code == 0 and 'termination' not in job else 'failed', exit_code=code)
            except (OSError, subprocess.SubprocessError):
                job.update(status='failed', error='Verification executor failed')
            finally:
                job['finished'] = time.time()
                self.save(out, job)

    def receipt(self, body):
        fields(body, ['name', 'content'])
        name, content = body['name'], body['content']
        if not isinstance(name, str) or not re.fullmatch(r'cloud-task-[a-z0-9-]{1,80}\.(md|json)', name):
            raise Rejected('Invalid qualification receipt name')
        if not isinstance(content, str) or len(content.encode()) > 65536 or re.search(r'BEGIN .*PRIVATE KEY|tskey-(auth|client)-', content):
            raise Rejected('Invalid or credential-bearing receipt')
        result = edit_file(self.root, 'docs/Infrastructure/' + name, content.encode(), None)
        return {**result, 'path': str(self.root / 'docs/Infrastructure' / name)}

    def dispatch(self, method, url, body=None):
        parsed = urlsplit(url)
        query = parse_qs(parsed.query, keep_blank_values=True)
        def arg(name, default=None):
            values = query.get(name, [default])
            if len(values) != 1:
                raise Rejected('Duplicate query argument')
            return values[0]
        with self.lock:
            if method == 'GET' and parsed.path == '/v1/identity':
                return self.identity()
            if method == 'POST' and parsed.path == '/v1/tasks':
                return self.create_task(body)
            if method == 'POST' and parsed.path == '/v1/receipts':
                return self.receipt(body)
            if method == 'GET' and parsed.path.startswith('/v1/jobs/'):
                return self.job(parsed.path.removeprefix('/v1/jobs/'))
            match = re.fullmatch(r'/v1/tasks/([^/]+)(?:/(files|file|diff|checks|stage))?', parsed.path)
            if match:
                task, action = match.groups()
                record, path = self.task(task)
                if method == 'GET' and action is None:
                    return record
                if method == 'GET' and action == 'files':
                    return self.files(path, int(arg('offset', '0')))
                if method == 'GET' and action == 'file':
                    return read_file(path, arg('path'), int(arg('offset', '0')), int(arg('length', str(MAX_READ))))
                if method == 'POST' and action == 'file':
                    fields(body, ['path', 'base64', 'expected_sha256'], ['executable'])
                    try:
                        content = base64.b64decode(body['base64'], validate=True)
                    except (ValueError, TypeError, binascii.Error):
                        raise Rejected('Invalid file encoding')
                    return edit_file(path, body['path'], content, body['expected_sha256'], executable=body.get('executable'))
                if method == 'DELETE' and action == 'file':
                    fields(body, ['path', 'expected_sha256'])
                    return edit_file(path, body['path'], b'', body['expected_sha256'], delete=True)
                if method == 'GET' and action == 'diff':
                    diff = run(['git', '-C', str(path), 'diff', '--no-ext-diff', '--binary', 'HEAD'])
                    if len(diff.encode()) > MAX_BODY:
                        raise Rejected('Diff exceeds response limit', 413)
                    return {'task': task, 'diff': diff}
                if method == 'POST' and action == 'checks':
                    return self.start_check(task, body)
                if method == 'POST' and action == 'stage':
                    return self.stage(task, body)
            if method == 'GET' and parsed.path == '/v1/materials':
                roots = {'docs': 'docs', 'exports': 'exports', 'meeting': 'uupg+ data meeting'}
                if arg('root') not in roots:
                    raise Rejected('Unknown material root')
                prefix = roots[arg('root')]
                safe_parts(prefix + '/' + str(arg('path')))
                return read_file(self.root, prefix + '/' + str(arg('path')), int(arg('offset', '0')), int(arg('length', str(MAX_READ))))
            if method == 'GET' and parsed.path == '/v1/materials/files':
                roots = {'docs': 'docs', 'exports': 'exports', 'meeting': 'uupg+ data meeting'}
                if arg('root') not in roots:
                    raise Rejected('Unknown material root')
                material = self.root / roots[arg('root')]
                if material.is_symlink() or material.resolve(strict=True).parent != self.root:
                    raise Rejected('Material root escapes project')
                names = []
                for parent, directories, files in os.walk(material, followlinks=False):
                    directories[:] = [name for name in sorted(directories)
                                      if name.lower() not in BLOCKED and not Path(parent, name).is_symlink()]
                    for name in files:
                        relative = str(Path(parent, name).relative_to(material))
                        try:
                            safe_parts(relative)
                        except Rejected:
                            continue
                        if not Path(parent, name).is_symlink():
                            names.append(relative)
                offset = int(arg('offset', '0'))
                if offset < 0:
                    raise Rejected('Invalid listing offset')
                names.sort()
                return {'root': arg('root'), 'files': names[offset:offset + 200], 'total': len(names),
                        'next_offset': min(offset + 200, len(names))}
            raise Rejected('Unknown API operation', 404)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log request headers or bodies.

    def handle_request(self):
        try:
            caps = self.headers.get_all('Tailscale-App-Capabilities', [])
            if len(caps) != 1 or not authorized(caps[0]):
                raise Rejected('Development capability required', 403)
            body = None
            if self.command in {'POST', 'DELETE'}:
                sizes = self.headers.get_all('Content-Length', [])
                if self.headers.get('Transfer-Encoding') or len(sizes) != 1 or self.headers.get_content_type() != 'application/json':
                    raise Rejected('JSON content with one length is required')
                size = int(sizes[0])
                if not 0 < size <= MAX_BODY:
                    raise Rejected('Request size exceeds limit', 413)
                body = json.loads(self.rfile.read(size))
            result = self.server.workspace.dispatch(self.command, self.path, body)
            code = 200
        except Rejected as error:
            code, result = error.status, {'error': str(error)}
        except FileNotFoundError:
            code, result = 404, {'error': 'Requested file or task is missing'}
        except (ValueError, TypeError, OSError, KeyError):
            code, result = 400, {'error': 'Invalid request or unsafe filesystem object'}
        except Exception:
            code, result = 500, {'error': 'Development operation failed'}
        raw = json.dumps(result).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    do_GET = handle_request
    do_POST = handle_request
    do_DELETE = handle_request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/srv/accelerate-global'))
    parser.add_argument('--state', type=Path, default=Path('/srv/accelerate-global/.cloud-jobs'))
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    workspace = Workspace(args.root, args.state)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.workspace = workspace
    print(json.dumps({'service': 'accelerate-development-jobs', 'listen': '127.0.0.1', 'port': args.port}), flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
