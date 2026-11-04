"""Preparation only. Importable pure state tests never call RUN.
A reviewed packet and separate explicit human execution approval remain required.
"""
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import stat
import subprocess
import time

PACKET = Path('/private/tmp/axiom-cssm-policy-artifacts/qualification-manifest.json')
PACKET_SHA256 = 'UNCOMPILED_UNEXECUTED_REQUIRES_REVIEW'
HELPER = '/private/tmp/axiom-cssm-policy-artifacts/qualification-helper'
FIXTURE = '/private/tmp/axiom-cssm-policy-artifacts/pure-test'
FIXTURE_SHA256 = 'd136d3f7d7c8135a543161afd4fa5127772bd1c35f41ed45cc37bf8d513e6f5e'
DEADLINE = 10.0
OUTPUT_LIMIT = 2048
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'HOME': '/var/empty', 'TMPDIR': '/private/tmp'}


def binding(path, expected=None):
    """Read only a resolved ordinary owned file; refuse symlinks at all levels."""
    p = Path(path)
    if not p.is_absolute() or str(p.resolve(strict=True)) != str(p):
        raise ValueError('file-binding')
    fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_uid != os.getuid() or before.st_nlink != 1:
            raise ValueError('file-binding')
        h = hashlib.sha256()
        while True:
            b = os.read(fd, 65536)
            if not b:
                break
            h.update(b)
        after = os.fstat(fd)
        if before != after or os.stat(p, follow_symlinks=False) != after:
            raise ValueError('file-changed')
        result = {'path': str(p), 'uid': after.st_uid, 'mode': stat.S_IMODE(after.st_mode),
                  'dev': after.st_dev, 'ino': after.st_ino, 'size': after.st_size,
                  'mtime_ns': after.st_mtime_ns, 'ctime_ns': after.st_ctime_ns,
                  'sha256': h.hexdigest()}
        if expected is not None and result != expected:
            raise ValueError('file-changed')
        return result
    finally:
        os.close(fd)


def observation(elapsed, length, returncode):
    # Deadline/overflow overrides any later success, including already-exited child.
    if elapsed >= DEADLINE:
        return 'unknown-timeout'
    if length > OUTPUT_LIMIT:
        return 'unknown-output-overflow'
    if returncode is not None:
        return 'completed' if returncode in (0, 1) else 'unknown-child-failure'
    return 'pending'


def preflight():
    packet_binding = binding(PACKET)
    if packet_binding['mode'] != 0o600 or packet_binding['sha256'] != PACKET_SHA256:
        raise ValueError('packet-unreviewed')
    packet = json.loads(PACKET.read_bytes())
    if packet['state'] != 'compile-reviewed-execution-still-requires-specific-approval':
        raise ValueError('packet-uncompiled')
    records = packet['files']
    if len({r['path'] for r in records}) != len(records):
        raise ValueError('duplicate-binding')
    by_path = {r['path']: r for r in records}
    if HELPER not in by_path or FIXTURE not in by_path:
        raise ValueError('missing-binding')
    for r in records:
        binding(r['path'], r)
    fixture = by_path[FIXTURE]
    if fixture['uid'] != 501 or fixture['mode'] != 0o600 or fixture['size'] != 138024 or fixture['sha256'] != FIXTURE_SHA256:
        raise ValueError('fixture-mismatch')
    with open(FIXTURE, 'rb') as f:
        if f.read(4) not in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'):
            raise ValueError('fixture-format')
    if by_path[HELPER]['mode'] != 0o700:
        # Compile artifact stays 0600 until separately approved execution prep.
        raise ValueError('helper-not-execution-prepared')
    binding(PACKET, packet_binding)
    return records, packet_binding


def RUN():
    """Never invoked during preparation, including --help. One child, no retry."""
    records, packet_binding = preflight()
    child = None
    selector = selectors.DefaultSelector()
    output = bytearray()
    state = 'unknown-launch'
    started = time.monotonic()
    try:
        child = subprocess.Popen([HELPER], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, env=ENV, cwd='/private/tmp',
                                 start_new_session=True, close_fds=True)
        os.set_blocking(child.stdout.fileno(), False)
        selector.register(child.stdout, selectors.EVENT_READ)
        while True:
            elapsed = time.monotonic() - started
            state = observation(elapsed, len(output), child.poll())
            if state != 'pending' and (state != 'completed' or not selector.get_map()):
                break
            for key, _ in selector.select(max(0, min(0.05, DEADLINE-elapsed))):
                chunk = os.read(key.fd, OUTPUT_LIMIT + 1 - len(output))
                if not chunk:
                    selector.unregister(key.fileobj)
                else:
                    output.extend(chunk)
            if len(output) > OUTPUT_LIMIT:
                state = 'unknown-output-overflow'
                break
        if state != 'completed':
            # Only the one group created above; no platform/service discovery.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        try:
            child.wait(timeout=1)
        except subprocess.TimeoutExpired:
            return {'result': 'unknown-unreaped-owned-child', 'owned_pid': child.pid}
        for r in records:
            binding(r['path'], r)
        binding(PACKET, packet_binding)
        if state != 'completed':
            return {'result': state}
        result = json.loads(output)
        if set(result) != {'profile', 'stage', 'result', 'osstatus', 'structural_pass', 'entries', 'source_revision', 'source_sha256', 'phase'}:
            raise ValueError('output-schema')
        if (result['source_revision'] != 'ad8efae1-source-preparation' or result['source_sha256'] != '86f79ef1efb1fd05486eabb0df99d3173ea75c157ad2a3bccf8a62acc4b888d9'
                or result['phase'] not in ('claim', 'security', 'applications-array', 'authorizations-array', 'copy', 'inspect')
                or result['profile'] != 'fixed-fixture-1' or type(result['stage']) is not int or not 0 <= result['stage'] <= 7
                or result['result'] not in ('success', 'refused') or type(result['osstatus']) is not int
                or not -(2**31) <= result['osstatus'] < 2**31 or type(result['structural_pass']) is not bool
                or type(result['entries']) is not int or not 0 <= result['entries'] <= 2**32-1):
            raise ValueError('output-schema')
        return {'result': 'completed', 'serialization': result}
    except Exception:
        if child is not None and child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                return {'result': 'unknown-unreaped-owned-child', 'owned_pid': child.pid}
        return {'result': 'unknown-incomplete'}
    finally:
        selector.close()
        if child is not None and child.stdout is not None:
            child.stdout.close()


if __name__ == '__main__':
    # Fail closed in the preparation source; no arguments trigger a launch.
    raise SystemExit('UNCOMPILED / UNEXECUTED: separate reviewed execution packet required')
