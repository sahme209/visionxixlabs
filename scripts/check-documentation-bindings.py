#!/usr/bin/env python3
"""Offline source-binding checks only; no customer or runtime qualification."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = 'docs/product/knowledge'
REGISTRY = DIRECTORY + '/control-binding-checks.json'
NODE = Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
SANDBOX = Path('/usr/bin/sandbox-exec')
TIMEOUT = 60
OUTPUT_CAP = 2 * 1024 * 1024


def safe_file(root, relative):
    if root.is_symlink() or root.resolve() != root or not root.is_dir():
        raise RuntimeError('canonical repository directory required')
    if not isinstance(relative, str) or not relative or '\\' in relative:
        raise RuntimeError('invalid relative path')
    parts = PurePosixPath(relative)
    if not parts.parts or parts.is_absolute() or '..' in parts.parts or relative != parts.as_posix():
        raise RuntimeError('noncanonical relative path')
    current = root
    for index, part in enumerate(parts.parts):
        current = current / part
        mode = current.lstat().st_mode
        if stat.S_ISLNK(mode) or (index < len(parts.parts) - 1 and not stat.S_ISDIR(mode)):
            raise RuntimeError('symlink or invalid path ancestor')
    if not stat.S_ISREG(mode):
        raise RuntimeError('regular file required')
    return current


def preflight(root):
    path = safe_file(root, REGISTRY)
    if path.stat().st_size > 65536:
        raise RuntimeError('registry too large')
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise RuntimeError('duplicate JSON key')
            result[key] = value
        return result
    data = json.loads(path.read_text(), object_pairs_hook=unique_object)
    if not isinstance(data, dict) or set(data) != {'format', 'customerEligible', 'publicationApproved', 'tests'} or data['format'] != 'axiom.control-binding-checks/1' or data['customerEligible'] is not False or data['publicationApproved'] is not False:
        raise RuntimeError('invalid registry schema')
    if not isinstance(data['tests'], list) or not 1 <= len(data['tests']) <= 100:
        raise RuntimeError('invalid registry tests')
    paths = []
    for record in data['tests']:
        if not isinstance(record, dict) or set(record) != {'path', 'sha256'} or not isinstance(record['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', record['sha256']):
            raise RuntimeError('invalid test record')
        name = record['path']
        target = safe_file(root, name)
        if PurePosixPath(name).parent.as_posix() != DIRECTORY or not re.fullmatch('[a-z][a-z0-9-]*bindings\.test\.cjs', target.name):
            raise RuntimeError('unknown binding test path')
        if name in paths:
            raise RuntimeError('duplicate binding test')
        if target.stat().st_size > 262144 or hashlib.sha256(target.read_bytes()).hexdigest() != record['sha256']:
            raise RuntimeError('binding test hash mismatch')
        paths.append(name)
    discovered = {p.relative_to(root).as_posix() for p in (root / DIRECTORY).glob('*bindings.test.cjs')}
    if set(paths) != discovered:
        raise RuntimeError('unregistered or missing binding test')
    return sorted(paths)


def child_bounds():
    import resource
    resource.setrlimit(resource.RLIMIT_FSIZE, (OUTPUT_CAP, OUTPUT_CAP))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def run_child(command, root, env, log):
    process = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.DEVNULL,
                               stdout=log, stderr=subprocess.STDOUT, start_new_session=True, preexec_fn=child_bounds)
    deadline = time.monotonic() + TIMEOUT
    reaped = False
    try:
        while True:
            if os.fstat(log.fileno()).st_size >= OUTPUT_CAP:
                raise RuntimeError('binding check output cap reached')
            if time.monotonic() >= deadline:
                raise RuntimeError('binding check timeout')
            try:
                code = process.wait(timeout=0.05)
                reaped = True
                if os.fstat(log.fileno()).st_size >= OUTPUT_CAP:
                    raise RuntimeError('binding check output cap reached')
                return code
            except subprocess.TimeoutExpired:
                continue
    finally:
        # An unreaped child reserves its PID. Never signal a reused group ID
        # after wait() has reaped the parent; Node owns/waits its test workers.
        if not reaped:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=5)



def execute(root, tests):
    if platform.system() != 'Darwin' or not hasattr(os, 'killpg'):
        raise RuntimeError('required restriction platform unavailable')
    for binary in [NODE, SANDBOX]:
        if binary.resolve() != binary or not stat.S_ISREG(binary.lstat().st_mode) or not os.access(binary, os.X_OK):
            raise RuntimeError('fixed executable unavailable')
    owned = Path(tempfile.mkdtemp(prefix='axiom-documentation-bindings-', dir='/private/tmp'))
    for name in ['home', 'tmp', 'cache']:
        (owned / name).mkdir(mode=0o700)
    profile = '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath ' + json.dumps(str(owned)) + '))'
    env = {'PATH': '/usr/bin:/bin', 'HOME': str(owned / 'home'), 'TMPDIR': str(owned / 'tmp'),
           'XDG_CACHE_HOME': str(owned / 'cache'), 'NODE_DISABLE_COMPILE_CACHE': '1', 'LANG': 'C', 'TZ': 'UTC'}
    command = [str(SANDBOX), '-p', profile, str(NODE), '--test', *tests]
    print('Private check log: ' + str(owned / 'checks.log'), flush=True)
    # Kernel file-size limit also bounds output between parent polling checks.
    with (owned / 'checks.log').open('xb') as log:
        os.chmod(owned / 'checks.log', 0o600)
        code = run_child(command, root, env, log)
    if (owned / 'checks.log').stat().st_size >= OUTPUT_CAP:
        raise RuntimeError('binding check output cap reached')
    sys.stdout.buffer.write((owned / 'checks.log').read_bytes()[:OUTPUT_CAP])
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true', help='validate registry and list checks without executing')
    args = parser.parse_args()
    tests = preflight(ROOT)
    if args.list:
        print('\n'.join(tests))
        return 0
    return execute(ROOT, tests)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print('Documentation binding checks refused: ' + str(exc), file=sys.stderr)
        raise SystemExit(1)
