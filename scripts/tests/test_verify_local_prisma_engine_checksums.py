import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import sys
import time
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location('collector', Path(__file__).parents[1] / 'verify-local-prisma-engine-checksums.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)

class Response:
    status = 200
    def __init__(self, url, body): self.url, self.body, self.reads = url, body, []
    def geturl(self): return self.url
    def read(self, n): self.reads.append(n); return self.body[:n]
    def __enter__(self): return self
    def __exit__(self, *args): pass

class CollectorTests(unittest.TestCase):
    def run_collector(self, effects, existing=False, only=None):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root); receipt = root / 'receipt.json'
            cache = root / '.cache/prisma/master' / m.COMMIT / 'darwin-arm64'; cache.mkdir(parents=True)
            for _, name in m.ENGINES:
                (cache / name).write_bytes(b'actual engine bytes')
                (cache / (name + '.sha256')).write_text('0' * 64)
            if existing: receipt.write_text('ORIGINAL')
            class Opener:
                calls = []
                def open(self, request, timeout):
                    self.calls.append((request.full_url, request.get_method(), timeout, request.headers))
                    effect = effects[len(self.calls)-1]
                    if isinstance(effect, Exception): raise effect
                    return effect
            opener = Opener()
            with patch.object(m, 'run_request', side_effect=m.fetch_one), patch.object(m.Path, 'home', return_value=root), patch.object(m.urllib.request, 'build_opener', return_value=opener), patch('sys.argv', ['collector', '--receipt', str(receipt)] + (['--only',only] if only else [])), contextlib.redirect_stdout(io.StringIO()):
                if existing:
                    with self.assertRaises(FileExistsError): m.main()
                    self.assertEqual(receipt.read_text(), 'ORIGINAL')
                    return opener.calls
                code = m.main()
            return code, json.loads(receipt.read_text()), opener.calls

    def test_success_exact_two_gets_and_actual_fd_hash_not_sidecar(self):
        digest = hashlib.sha256(b'actual engine bytes').hexdigest()
        responses = [Response(m.BASE + name + '.sha256', (digest + '  ' + name + '\n').encode()) for name, _ in m.ENGINES]
        code, receipt, calls = self.run_collector(responses)
        self.assertEqual(code, 0); self.assertTrue(receipt['allMatched'])
        self.assertEqual([c[:3] for c in calls], [(m.BASE + n + '.sha256', 'GET', 20) for n, _ in m.ENGINES])
        self.assertTrue(all(not c[3] for c in calls)); self.assertEqual([r.reads for r in responses], [[1025], [1025]])
        self.assertFalse(receipt['mutableSidecarsRead']); self.assertFalse(receipt['executionAuthorized'])

    def test_http_status_retained_without_remote_body_or_reason(self):
        errors = [urllib.error.HTTPError(m.BASE + n + '.sha256', code, 'REMOTE_SECRET', {}, io.BytesIO(b'PRIVATE_BODY')) for (n, _), code in zip(m.ENGINES, (403,404))]
        code, receipt, calls = self.run_collector(errors)
        self.assertEqual(code, 1); self.assertEqual(len(calls), 2)
        self.assertEqual([r['httpStatus'] for r in receipt['results']], [403,404])
        self.assertNotIn('REMOTE_SECRET', json.dumps(receipt)); self.assertNotIn('PRIVATE_BODY', json.dumps(receipt))

    def test_redirect_refused_and_status_preserved_no_second_host(self):
        request = m.urllib.request.Request(m.BASE + 'schema-engine.sha256')
        try: m.NoRedirect().redirect_request(request, None, 302, 'remote', {}, 'https://other.invalid/secret')
        except Exception as error: redirect = error
        code, receipt, calls = self.run_collector([redirect, redirect])
        self.assertEqual(code, 1); self.assertEqual(len(calls), 2)
        self.assertEqual([r['httpStatus'] for r in receipt['results']], [302,302])
        self.assertTrue(all(c[0].startswith(m.BASE) for c in calls))

    def test_capped_and_invalid_bodies_refuse(self):
        responses = [Response(m.BASE + m.ENGINES[0][0] + '.sha256', b'a' * 1025), Response(m.BASE + m.ENGINES[1][0] + '.sha256', b'0' * 64 + b'  wrong-file\n')]
        code, receipt, calls = self.run_collector(responses)
        self.assertEqual(code, 1); self.assertEqual(len(calls), 2)
        self.assertEqual([r['reason'] for r in receipt['results']], ['checksum_body_too_large','invalid_checksum_body'])

    def test_unexpected_exception_message_never_exported(self):
        _, receipt, _ = self.run_collector([RuntimeError('ENV_SECRET'), RuntimeError('ENV_SECRET')])
        self.assertNotIn('ENV_SECRET', json.dumps(receipt))

    def test_existing_receipt_refuses_before_requests(self):
        self.assertEqual(self.run_collector([], existing=True), [])

    def test_selected_schema_never_requests_query(self):
        error = urllib.error.HTTPError(m.BASE + 'schema-engine.sha256', 404, 'remote', {}, None)
        code, receipt, calls = self.run_collector([error], only='schema')
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0], m.BASE + 'schema-engine.sha256')
        self.assertEqual(receipt['requestsAttempted'], 1)
        self.assertEqual(receipt['selection'], 'schema')

    def test_actual_slow_child_terminated_reaped_without_network(self):
        with tempfile.TemporaryDirectory() as root:
            pidfile = Path(root)/'pid'
            code = "import os,time;open(%r,'w').write(str(os.getpid()));time.sleep(30)" % str(pidfile)
            started = time.monotonic()
            output, error = m.collect_child([sys.executable, '-c', code], 0.25)
            self.assertEqual(error, 'parent_wall_timeout'); self.assertIsNone(output)
            self.assertLess(time.monotonic()-started, 3)
            pid = int(pidfile.read_text())
            with self.assertRaises(ProcessLookupError): os.kill(pid, 0)
            with self.assertRaises(ChildProcessError): os.waitpid(pid, os.WNOHANG)

    def test_worker_receipt_strict_and_parent_timeout_safe(self):
        for output in (b'{"match":true}', b'{"match":false,"match":true}', b'not json'):
            with patch.object(m, 'collect_child', return_value=(output,None)):
                result = m.run_request('schema')
                self.assertEqual(result['reason'],'invalid_worker_result')
                self.assertFalse(result['match'])
        with patch.object(m, 'collect_child', return_value=(None,'parent_wall_timeout')):
            result = m.run_request('query')
            self.assertEqual(result['reason'], 'parent_wall_timeout')

    def test_worker_cannot_claim_match_without_both_hashes(self):
        forged = {**m.base_item('schema'), 'match': True, 'httpStatus':200, 'bytes':1}
        with patch.object(m, 'collect_child', return_value=(json.dumps(forged).encode(),None)):
            self.assertEqual(m.run_request('schema')['reason'], 'invalid_worker_result')

    def test_actual_child_has_no_inherited_credentials_or_loader_env(self):
        with patch.dict(os.environ, {'NPM_CONFIG_TOKEN':'SECRET','NODE_OPTIONS':'SECRET','HTTP_PROXY':'SECRET'}):
            output, error = m.collect_child([sys.executable,'-c','import os,json;print(json.dumps(dict(os.environ)))'], 2)
        self.assertIsNone(error)
        env = json.loads(output)
        self.assertNotIn('NPM_CONFIG_TOKEN',env); self.assertNotIn('NODE_OPTIONS',env); self.assertNotIn('HTTP_PROXY',env)

    def test_hash_refuses_symlink_and_hardlink(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/'engine'; path.write_bytes(b'engine')
            link = Path(root)/'link'; link.symlink_to(path)
            with self.assertRaises(OSError): m.stable_hash(link)
            hard = Path(root)/'hard'; os.link(path, hard)
            with self.assertRaises(RuntimeError): m.stable_hash(hard)

if __name__ == '__main__': unittest.main()
