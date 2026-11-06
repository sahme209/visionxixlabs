#!/usr/bin/env python3
"""Two explicitly approved vendor checksum reads; no engine download or build."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import signal
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

COMMIT = '605197351a3c8bdd595af2d2a9bc3025bca48ea2'
BASE = f'https://binaries.prisma.sh/all_commits/{COMMIT}/darwin-arm64/'
ENGINES = [('libquery_engine.dylib.node', 'libquery-engine'), ('schema-engine', 'schema-engine')]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, 'redirect_refused', headers, None)

def state(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)

def stable_hash(path):
    before = path.lstat()
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or state(before) != state(opened):
            raise RuntimeError('unstable_or_nonregular_engine')
        if not 0 < opened.st_size <= 64 * 1024 * 1024:
            raise RuntimeError('engine_size_unsupported')
        digest = hashlib.sha256()
        count = 0
        while True:
            chunk = os.read(fd, min(1024 * 1024, opened.st_size - count + 1))
            if not chunk:
                break
            count += len(chunk)
            if count > opened.st_size:
                raise RuntimeError('engine_grew')
            digest.update(chunk)
        if count != opened.st_size or state(opened) != state(os.fstat(fd)) or state(opened) != state(path.lstat()):
            raise RuntimeError('engine_changed')
        return digest.hexdigest(), count
    finally:
        os.close(fd)

KINDS = {'query': ENGINES[0], 'schema': ENGINES[1]}

def base_item(kind):
    vendor_name, cache_name = KINDS[kind]
    return {'sourceUrl': BASE + vendor_name + '.sha256',
            'cachePath': str(Path.home() / '.cache/prisma/master' / COMMIT / 'darwin-arm64' / cache_name)}

def fetch_one(kind):
    vendor_name, _ = KINDS[kind]
    item = base_item(kind)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        request = urllib.request.Request(item['sourceUrl'], method='GET')
        with opener.open(request, timeout=20) as response:
            item['httpStatus'] = response.status
            if response.status != 200 or response.geturl() != item['sourceUrl']:
                raise RuntimeError('unexpected_http_response')
            body = response.read(1025)
            if len(body) > 1024:
                raise RuntimeError('checksum_body_too_large')
        text = body.decode('ascii')
        pattern = r'([0-9a-fA-F]{64})(?:[ \t]+\*?' + re.escape(vendor_name) + r')?\r?\n?'
        match = re.fullmatch(pattern, text)
        if not match:
            raise RuntimeError('invalid_checksum_body')
        item['expectedSha256'] = match.group(1).lower()
        item['actualSha256'], item['bytes'] = stable_hash(Path(item['cachePath']))
        item['match'] = item['expectedSha256'] == item['actualSha256']
    except Exception as exc:
        if isinstance(exc, urllib.error.HTTPError):
            item['httpStatus'] = exc.code
        item['match'] = False
        item['errorType'] = type(exc).__name__
        safe_reasons = {'unstable_or_nonregular_engine', 'engine_size_unsupported',
                        'engine_grew', 'engine_changed', 'unexpected_http_response',
                        'checksum_body_too_large', 'invalid_checksum_body'}
        item['reason'] = str(exc) if type(exc) is RuntimeError and str(exc) in safe_reasons else 'request_or_local_read_failed'
    return item

def _cleanup_owned_worker(process):
    # Signal only while this exact original child remains unreaped. Never retry
    # an unknown numeric group after losing that ownership observation.
    try:
        if process.poll() is not None:
            return True
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)
        return True
    except BaseException:
        return False

def collect_child(command, timeout):
    with tempfile.TemporaryFile() as captured:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=captured,
                                   stderr=subprocess.DEVNULL, start_new_session=True,
                                   env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'TZ': 'UTC'})
        try:
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                clean = _cleanup_owned_worker(process)
                return None, 'parent_wall_timeout' if clean else 'parent_worker_cleanup_unknown'
            captured.seek(0)
            output = captured.read(4097)
            if process.returncode != 0 or len(output) > 4096:
                return None, 'invalid_worker_result'
            return output, None
        except BaseException as error:
            clean = _cleanup_owned_worker(process)
            if not clean:
                raise RuntimeError('parent_worker_cleanup_unknown') from None
            if isinstance(error, (KeyboardInterrupt, SystemExit)):
                raise
            return None, 'parent_worker_unavailable'

def run_request(kind):
    output, error = collect_child([sys.executable, str(Path(__file__).resolve()), '--worker', kind], 22)
    item = base_item(kind)
    if error:
        return {**item, 'match': False, 'reason': error}
    try:
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result: raise ValueError('duplicate')
                result[key] = value
            return result
        result = json.loads(output, object_pairs_hook=unique)
        allowed = {'sourceUrl', 'cachePath', 'httpStatus', 'expectedSha256', 'actualSha256', 'bytes', 'match', 'reason', 'errorType'}
        reasons = {'unstable_or_nonregular_engine', 'engine_size_unsupported', 'engine_grew', 'engine_changed',
                   'unexpected_http_response', 'checksum_body_too_large', 'invalid_checksum_body', 'request_or_local_read_failed'}
        if not isinstance(result, dict) or set(result) - allowed or any(result.get(k) != v for k,v in item.items()): raise ValueError('binding')
        if type(result.get('match')) is not bool: raise ValueError('match')
        if 'httpStatus' in result and (type(result['httpStatus']) is not int or not 100 <= result['httpStatus'] <= 599): raise ValueError('status')
        for key in ('expectedSha256','actualSha256'):
            if key in result and (not isinstance(result[key], str) or not re.fullmatch('[0-9a-f]{64}',result[key])): raise ValueError('hash')
        if 'bytes' in result and (type(result['bytes']) is not int or not 0 < result['bytes'] <= 64*1024*1024): raise ValueError('size')
        if 'reason' in result and result['reason'] not in reasons: raise ValueError('reason')
        if 'errorType' in result and (not isinstance(result['errorType'],str) or not re.fullmatch('[A-Za-z]{1,64}',result['errorType'])): raise ValueError('error')
        if result['match'] and (result.get('httpStatus') != 200 or 'expectedSha256' not in result or 'actualSha256' not in result or result['expectedSha256'] != result['actualSha256'] or 'bytes' not in result): raise ValueError('positive')
        return result
    except (ValueError, TypeError, UnicodeError):
        return {**item, 'match': False, 'reason': 'invalid_worker_result'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--receipt')
    parser.add_argument('--only', choices=('all','schema','query'), default='all')
    parser.add_argument('--worker', choices=('schema','query'), help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        if args.receipt or args.only != 'all': parser.error('worker arguments conflict')
        print(json.dumps(fetch_one(args.worker), sort_keys=True))
        return 0
    if not args.receipt: parser.error('--receipt required')
    # Existing receipts refuse before any request; descriptor retained until saved.
    fd = os.open(args.receipt, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        kinds = ('query','schema') if args.only == 'all' else (args.only,)
        results = [run_request(kind) for kind in kinds]
        receipt = {'format': 'axiom.local-prisma-vendor-checksum/1', 'engineCommit': COMMIT,
                   'platform': 'darwin-arm64', 'requestsAttempted': len(kinds), 'selection': args.only, 'retries': 0,
                   'parentWallDeadlineSecondsPerRequest': 22,
                   'binaryDownloads': 0, 'mutableSidecarsRead': False, 'results': results,
                   'allMatched': all(x['match'] for x in results), 'buildStarted': False,
                   'executingIssuerIdentity': 'unavailable', 'executionAuthorized': False}
        json.dump(receipt, output, indent=2, sort_keys=True)
        output.write('\n')
    print(json.dumps(receipt, sort_keys=True))
    return 0 if receipt['allMatched'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
