"""Owned local HTML/static preview guard. Import is pure except fixed manifest read.
No app, API, auth, browser, provider or server is started by import/tests.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote, quote, urlencode
from http.client import HTTPConnection, HTTPException
from pathlib import Path
import hashlib
import json
import re

ROOT = Path('/private/tmp/axiom-preview-harness-1b23c208-20261104')
MANIFEST_SHA256 = 'e1d235bbd1216020a14f7272fce86190ded5bc801c206cb13693d84e674cd794'
manifest_bytes = (ROOT / 'asset-manifest.json').read_bytes()
if hashlib.sha256(manifest_bytes).hexdigest() != MANIFEST_SHA256:
    raise RuntimeError('preview manifest identity mismatch')
MANIFEST = json.loads(manifest_bytes)
BACKEND = ('127.0.0.1', 5225)
LISTEN = ('127.0.0.1', 5224)
MAX_RESPONSE = 32 * 1024 * 1024
REQUEST_HEADERS = {'accept', 'accept-language'}
RESPONSE_HEADERS = {'content-encoding', 'content-language', 'etag', 'last-modified'}
DENIED = ('/api', '/auth', '/account', '/operator', '/dashboard', '/admin', '/billing', '/desktop', '/workspace-handoff')
CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-src 'self'; frame-ancestors 'self'"
WRAPPER = b'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Axiom local preview - 1b23c208</title></head><body style="margin:0;background:#101010"><div role="status" style="min-height:40px;box-sizing:border-box;padding:11px 18px;background:#ecebe5;color:#242424;font:12px system-ui">Local HTML/static preview - source 1b23c208 - accounts, forms and backend actions disabled</div><iframe title="Axiom local website" src="/" sandbox="allow-scripts allow-same-origin" style="width:100%;height:calc(100dvh - 40px);border:0;display:block"></iframe></body></html>'''


def clean_text(value):
    return isinstance(value, str) and not any(ord(c) <= 32 or ord(c) == 127 for c in value) and chr(92) not in value


def decode_once(value):
    if re.search(r'%(?![0-9A-Fa-f]{2})', value):
        raise ValueError('malformed escape')
    decoded = unquote(value, encoding='utf-8', errors='strict')
    if '%' in decoded or not clean_text(decoded):
        raise ValueError('unsafe decoded target')
    return decoded


def canonical_path(raw):
    path = decode_once(raw)
    if not path.startswith('/') or path.startswith('//') or '//' in path or '?' in path or '#' in path:
        raise ValueError('not origin path')
    if any(part in {'.', '..'} for part in path.split('/')) or path.startswith(DENIED):
        raise ValueError('private or relative path')
    return path


def encoded_path(path):
    return quote(path, safe='/-._~@()')


def canonical_target(value):
    try:
        if not isinstance(value, str) or len(value) > 16384 or not clean_text(value) or not value.startswith('/') or value.startswith('//'):
            return None
        url = urlsplit(value)
        if url.scheme or url.netloc or url.fragment:
            return None
        path = canonical_path(url.path)
        if path == '/_next/image':
            # Exactly one of each supported key; no encoded keys or empty/extra data.
            values = {}
            for pair in url.query.split('&'):
                if pair.count('=') != 1:
                    return None
                key, raw = pair.split('=', 1)
                if key not in {'url', 'w', 'q'} or key in values or not raw:
                    return None
                values[key] = decode_once(raw)
            if set(values) != {'url', 'w', 'q'}:
                return None
            image = values['url']
            # A decoded optimizer URL is data, not another decoding opportunity.
            if canonical_path(image) != image or image not in MANIFEST['publicImages']:
                return None
            if not re.fullmatch(r'[1-9][0-9]{0,4}', values['w']) or not re.fullmatch(r'[1-9][0-9]{0,2}', values['q']):
                return None
            if int(values['w']) not in MANIFEST['imageWidths'] or int(values['q']) not in MANIFEST['imageQualities']:
                return None
            return '/_next/image?' + urlencode([('url', image), ('w', values['w']), ('q', values['q'])])
        if url.query:
            return None
        if path in MANIFEST['publicAssets'] or path in MANIFEST['nextStaticAssets']:
            return encoded_path(path)
        page = path[:-1] if path != '/' and path.endswith('/') else path
        if page in MANIFEST['publicPages'] or page == '/__axiom_preview':
            return encoded_path(page)
    except (ValueError, UnicodeError, TypeError):
        return None
    return None


def forward_headers(headers):
    # No Cookie, Authorization, Next-Action, RSC, router, host or forwarding fields.
    return {key: value for key, value in headers.items()
            if key.lower() in REQUEST_HEADERS and len(value) <= 8192 and '\r' not in value and '\n' not in value}


def filtered_response_headers(headers):
    # No Refresh, Link, Location, Set-Cookie or hop-by-hop fields.
    return [(key, value) for key, value in headers
            if key.lower() in RESPONSE_HEADERS and len(value) <= 8192 and '\r' not in value and '\n' not in value]


class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def output(self, status, data, kind='text/html; charset=utf-8', headers=()):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Axiom-Preview-Source', '1b23c208')
        for key, value in filtered_response_headers(headers):
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def deny_action(self):
        self.output(403, b'{"error":"Local preview actions disabled"}', 'application/json')

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_TRACE = do_CONNECT = deny_action

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        target = canonical_target(self.path)
        if target is None:
            return self.output(403, b'<h1>Local HTML/static preview only</h1>')
        if target == '/__axiom_preview':
            return self.output(200, WRAPPER)
        conn = HTTPConnection(*BACKEND, timeout=20)
        try:
            # Send only the vetted canonical target, never the original request.
            conn.request(self.command, target, headers=forward_headers(self.headers))
            response = conn.getresponse()
            if 300 <= response.status < 400 or response.getheader('Location') is not None or response.getheader('Refresh') is not None:
                return self.output(403, b'Preview redirect disabled')
            data = response.read(MAX_RESPONSE + 1)
            if len(data) > MAX_RESPONSE:
                return self.output(502, b'Preview response bound exceeded')
            kind = response.getheader('Content-Type') or 'application/octet-stream'
            if len(kind) > 1024 or '\r' in kind or '\n' in kind:
                return self.output(502, b'Preview response type unavailable')
            self.output(response.status, data, kind, response.getheaders())
        except (OSError, TimeoutError, HTTPException):
            self.output(502, b'Local preview backend unavailable')
        finally:
            conn.close()


if __name__ == '__main__':
    # Execution is a separate approval step; preparation/tests never reach here.
    print('LOCAL_HTML_STATIC_PREVIEW http://127.0.0.1:5224/__axiom_preview source1b23c208', flush=True)
    ThreadingHTTPServer(LISTEN, Proxy).serve_forever()
