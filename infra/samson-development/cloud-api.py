#!/usr/bin/env python3
"""Call the private Samson development API through the managed HTTPS proxy."""
import argparse
import json
import os
from pathlib import Path
import ssl
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

API_HOST = 'accelerate-dev.tail13a215.ts.net'


def endpoint(value):
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or parsed.hostname != API_HOST or parsed.port not in {None, 443} or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {'', '/'}:
        raise ValueError('Use the exact private Samson HTTPS origin')
    return value.rstrip('/')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        raise ValueError('The private API cannot redirect to another destination')


class ForceProxy(urllib.request.ProxyHandler):
    # Standard urllib honors NO_PROXY even with an explicit ProxyHandler. Private
    # Cloud requests must use the inherited HTTPS proxy, including its sandbox hop.
    def proxy_open(self, req, proxy, proxy_type):
        original_type = req.type
        parsed = urlsplit(proxy)
        if parsed.scheme != 'http' or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Unsupported inherited proxy URL')
        req.set_proxy(parsed.netloc, proxy_type)
        if original_type == proxy_type or original_type == 'https':
            return None
        return self.parent.open(req, timeout=req.timeout)


def request(origin, method, path, body=None, policy=None):
    origin = endpoint(origin)
    if not path.startswith('/v1/') or path.startswith('//') or '\\' in path or '\r' in path or '\n' in path:
        raise ValueError('Use a development API path')
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    if not proxy:
        raise ValueError('The inherited Cloud HTTPS proxy is required')
    if policy is None:
        policy = json.loads(Path('/etc/codex/network-policy.json').read_text())
    if not isinstance(policy, dict) or policy.get('version') != 1 or policy.get('vpn_configured') is not True:
        raise ValueError('Supported Cloud VPN runtime policy is required')
    context = ssl.create_default_context()
    opener = urllib.request.build_opener(ForceProxy({'https': proxy}),
                                        urllib.request.HTTPSHandler(context=context), NoRedirect())
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(origin + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with opener.open(req, timeout=45) as response:
            return json.loads(response.read(8 * 1024 * 1024))
    except urllib.error.HTTPError as error:
        detail = error.read(4096).decode('utf-8', 'replace')
        raise ValueError(f'Private API HTTP {error.code}: {detail}') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('method', choices=['GET', 'POST', 'DELETE'])
    parser.add_argument('path')
    parser.add_argument('--body-file', type=Path, help='JSON request body; use - to read stdin')
    args = parser.parse_args()
    body = None
    if args.body_file:
        raw = sys.stdin.read() if str(args.body_file) == '-' else args.body_file.read_text()
        body = json.loads(raw)
    result = request(os.environ.get('AX_CLOUD_API_URL', 'https://' + API_HOST), args.method, args.path, body)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, urllib.error.URLError) as error:
        raise SystemExit(str(error))
