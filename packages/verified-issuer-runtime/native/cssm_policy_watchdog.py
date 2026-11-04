"""Preparation only. Importable pure state tests never call RUN.
A reviewed packet and separate explicit human execution approval remain required.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import stat
import subprocess
import time
import sys

PACKET = Path('/private/tmp/axiom-cssm-policy-artifacts/qualification-manifest.json')
PACKET_SHA256 = 'UNCOMPILED_UNEXECUTED_REQUIRES_REVIEW'
HELPER = '/private/tmp/axiom-cssm-policy-artifacts/qualification-helper'
FIXTURE = '/private/tmp/axiom-cssm-policy-artifacts/pure-test'
FIXTURE_SHA256 = 'd136d3f7d7c8135a543161afd4fa5127772bd1c35f41ed45cc37bf8d513e6f5e'
DEADLINE = 10.0
OUTPUT_LIMIT = 2048
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'HOME': '/var/empty', 'TMPDIR': '/private/tmp'}


def stable_stat(value):
    # atime is observational and may change when this controller reads bytes.
    return tuple(getattr(value, field) for field in (
        'st_dev', 'st_ino', 'st_uid', 'st_gid', 'st_mode', 'st_nlink',
        'st_size', 'st_mtime_ns', 'st_ctime_ns'))


def validate_records(records):
    paths = [r['path'] for r in records]
    if str(Path(__file__).resolve()) in paths:
        raise ValueError('controller-external-binding')
    if str(PACKET) in paths:
        raise ValueError('packet-self-binding')
    if len(set(paths)) != len(paths):
        raise ValueError('duplicate-binding')
    if HELPER not in paths or FIXTURE not in paths:
        raise ValueError('missing-binding')
    return {r['path']: r for r in records}


def mode_transition_matches(before, after, mode):
    # ctime is captured after each declared chmod, never predicted in packet.
    return (after.get('mode') == mode and
            {k: v for k, v in before.items() if k not in ('mode', 'ctime_ns')} ==
            {k: v for k, v in after.items() if k not in ('mode', 'ctime_ns')})


@contextmanager
def execution_mode(expected):
    """Future authorized RUN only: exact helper0600 ->0700 ->0600.
    Retain its descriptor so restoration targets only that verified owned file.
    Fixture/source modes never change. Pure preparation tests mock these calls.
    """
    binding(HELPER, expected)
    fd = os.open(HELPER, os.O_RDONLY | os.O_NOFOLLOW)
    changed = False
    try:
        held = os.fstat(fd)
        if (held.st_dev, held.st_ino, held.st_uid, stat.S_IMODE(held.st_mode)) != (
                expected['dev'], expected['ino'], expected['uid'], 0o600):
            raise ValueError('helper-descriptor-changed')
        # Record intent first so a partial/exceptional chmod also restores.
        changed = True
        os.fchmod(fd, 0o700)
        active = binding(HELPER)
        if not mode_transition_matches(expected, active, 0o700):
            raise ValueError('helper-mode-transition')
        yield active
    finally:
        try:
            if changed:
                os.fchmod(fd, 0o600)
                restored = binding(HELPER)
                if not mode_transition_matches(expected, restored, 0o600):
                    raise ValueError('helper-mode-restoration')
        finally:
            os.close(fd)


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
        if stable_stat(before) != stable_stat(after) or stable_stat(os.stat(p, follow_symlinks=False)) != stable_stat(after):
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
    by_path = validate_records(records)
    for r in records:
        binding(r['path'], r)
    fixture = by_path[FIXTURE]
    if fixture['uid'] != 501 or fixture['mode'] != 0o600 or fixture['size'] != 138024 or fixture['sha256'] != FIXTURE_SHA256:
        raise ValueError('fixture-mismatch')
    with open(FIXTURE, 'rb') as f:
        if f.read(4) not in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'):
            raise ValueError('fixture-format')
    if by_path[HELPER]['mode'] != 0o600:
        raise ValueError('helper-preparation-mode')
    binding(PACKET, packet_binding)
    return records, packet_binding


def RUN():
    """Future explicitly approved attempt only. Never called during preparation."""
    outcome = None
    try:
        records, packet_binding = preflight()
        expected = next(r for r in records if r['path'] == HELPER)
        with execution_mode(expected) as active:
            outcome = observe_owned_child(records, packet_binding, active)
        return outcome
    except Exception:
        failure = {'result': 'unknown-preflight-or-mode-transition'}
        if outcome is not None and 'owned_pid' in outcome:
            failure['owned_pid'] = outcome['owned_pid']
        return failure


def observe_owned_child(records, packet_binding, active):
    """One owned child; called only by RUN after mode transition/preflight."""
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
            binding(r['path'], active if r['path'] == HELPER else r)
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


def main(arguments):
    # This operator instruction selects the reviewed one-attempt behavior.
    # It is not approval, Governance authority, or a grant token.
    if arguments != ['--run-reviewed-once']:
        return 2
    print(json.dumps(RUN(), separators=(',', ':')))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
