"""Governance gate 1 (first slice): the original-attempt journal on a real, disposable Linux host.

Runs the unmodified private journal primitive (scripts/governance_original_attempt.py) WITHOUT
mocking its ACL/xattr evidence, on real Linux filesystems, real processes and real POSIX ACLs.
Like the unit tests, it populates the private binding registry itself: this script is a
qualification harness, not an enrollment API, and it never enables Governance.

Usage (on a throwaway CI runner only):
  python3 scripts/governance_linux_host_check.py --receipt out.json            # as an ordinary user
  sudo -n python3 scripts/governance_linux_host_check.py --root --receipt r.json # root-owned + tmpfs cases
Exit status is 0 only if every scenario passed. Internal helper mode: --child <dir> <mode>.
"""
import hashlib, importlib.util, json, os, platform, shutil, signal, subprocess, sys, tempfile, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/governance_original_attempt.py'
RAW = ('AXIOM_ORIGINAL_ATTEMPT_V1\nowner_grant_host\ncontroller_host\nattempt_host\n' + 'a' * 64 + '\n' + 'b' * 64 + '\n' + 'c' * 64 + '\n' + 'd' * 64 + '\nEND\n').encode()
DIGEST = hashlib.sha256(RAW).hexdigest()


def load():
    spec = importlib.util.spec_from_file_location('attempt_gate_host_check', SOURCE)
    m = importlib.util.module_from_spec(spec); sys.modules[spec.name] = m; spec.loader.exec_module(m)
    return m


M = load()


def bind(anchor: Path):
    """Harness-only private registry population (same as the unit tests). Returns (binding, fds)."""
    journal = anchor / 'journal'
    parent = os.open(anchor.parent, os.O_RDONLY | os.O_DIRECTORY)
    a = os.open(anchor, os.O_RDONLY | os.O_DIRECTORY)
    j = os.open(journal, os.O_RDONLY | os.O_DIRECTORY)
    b = M._OriginalJournalBinding()
    dirs = (M._Directory(a, parent, anchor.name, os.fstat(a)), M._Directory(j, a, 'journal', os.fstat(j)))
    deadline = time.monotonic_ns() + 30_000_000_000
    M._BINDINGS[b] = M._BindingState(dirs, DIGEST, deadline, threading.Event(), os.getpid(), os.getuid(), os.fstat(j).st_gid)
    return b, deadline, (parent, a, j)


def fresh(base: Path, name: str) -> Path:
    anchor = base / name
    anchor.mkdir(mode=0o700)
    os.chmod(anchor, 0o700)
    (anchor / 'journal').mkdir(mode=0o700)
    os.chmod(anchor / 'journal', 0o700)
    return anchor


def consume(anchor: Path):
    b, deadline, fds = bind(anchor)
    try:
        return M.consume_original_attempt(b, RAW, DIGEST, deadline), fds
    except M.AttemptUnavailable:
        for fd in fds: os.close(fd)
        raise


def refused(anchor: Path) -> bool:
    try:
        g, fds = consume(anchor)
    except M.AttemptUnavailable:
        return True
    M.close_original_grant(g)
    for fd in fds: os.close(fd)
    return False


def marker(anchor: Path):
    p = anchor / 'journal' / 'consumed'
    if not p.exists(): return None
    st = p.stat()
    return {'bytes': p.read_bytes(), 'mode': oct(st.st_mode & 0o7777), 'uid': st.st_uid, 'nlink': st.st_nlink}


def child(dir_: str, mode: str):
    """Separate process: consume, report, then either exit or wait to be killed (crash)."""
    try:
        g, _ = consume(Path(dir_))
    except M.AttemptUnavailable:
        print('refused', flush=True); sys.exit(3)
    if mode == 'claim':
        M.claim_creation(g)
    print('consumed', flush=True)
    if mode == 'hang':
        time.sleep(120)
    sys.exit(0)


def run_child(anchor: Path, mode: str, kill_after_ready=False):
    p = subprocess.Popen([sys.executable, '-I', str(Path(__file__).resolve()), '--child', str(anchor), mode],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    line = p.stdout.readline().strip()
    if kill_after_ready and line == 'consumed':
        os.kill(p.pid, signal.SIGKILL)
    p.wait(timeout=60)
    return line, p.returncode


def has(cmd):
    return shutil.which(cmd) is not None


def scenarios(base: Path, as_root: bool):
    out = []

    def case(name, fn):
        try:
            ok, detail = fn()
        except Exception as e:  # a crash in the harness is a failure, never a pass
            ok, detail = False, f'{type(e).__name__}: {e}'
        out.append({'name': name, 'passed': bool(ok), 'detail': detail})

    def real_acl_evidence():
        anchor = fresh(base, 'xattr')
        fd = os.open(anchor / 'journal', os.O_RDONLY | os.O_DIRECTORY)
        try:
            return hasattr(os, 'listxattr') and M._no_extra_access(fd) is True, 'os.listxattr present; clean directory has no ACL or capability xattrs'
        finally:
            os.close(fd)
    case('real_acl_evidence_available', real_acl_evidence)

    def clean_consume():
        anchor = fresh(base, 'clean')
        g, fds = consume(anchor)
        m = marker(anchor)
        claim = M.claim_creation(g)
        try:
            M.claim_creation(g); second = 'allowed'
        except M.AttemptUnavailable:
            second = 'refused'
        M.close_original_grant(g)
        for fd in fds: os.close(fd)
        ok = m and m['bytes'] == RAW and m['mode'] == '0o600' and m['nlink'] == 1 and claim.qualified is False and second == 'refused'
        return ok, f"marker {m and m['mode']}, first claim local-only, second claim {second}"
    case('consume_writes_exact_marker_then_one_claim', clean_consume)

    def same_process_twice():
        anchor = fresh(base, 'twice')
        g, fds = consume(anchor)
        again = refused(anchor)
        M.close_original_grant(g)
        for fd in fds: os.close(fd)
        return again and marker(anchor)['bytes'] == RAW, 'second consume on the same journal refused; marker unchanged'
    case('second_attempt_refused', same_process_twice)

    def crash_then_restart():
        anchor = fresh(base, 'crash')
        line, rc = run_child(anchor, 'hang', kill_after_ready=True)
        before = marker(anchor)
        line2, rc2 = run_child(anchor, 'exit')
        after = marker(anchor)
        ok = line == 'consumed' and rc == -signal.SIGKILL and line2 == 'refused' and rc2 == 3 and before == after and before['bytes'] == RAW
        return ok, f'first process killed with SIGKILL after consuming (rc {rc}); restarted process {line2} (rc {rc2}); marker unchanged'
    case('crash_after_consume_cannot_start_again', crash_then_restart)

    def crash_after_claim():
        anchor = fresh(base, 'claimcrash')
        line, rc = run_child(anchor, 'claim')
        line2, rc2 = run_child(anchor, 'exit')
        return line == 'consumed' and rc == 0 and line2 == 'refused', f'claimed then exited; next process {line2}'
    case('claimed_run_cannot_start_again', crash_after_claim)

    def partial_marker():
        anchor = fresh(base, 'partial')
        fd = os.open(anchor / 'journal' / 'consumed', os.O_CREAT | os.O_WRONLY | os.O_EXCL, 0o600); os.close(fd)
        ok = refused(anchor) and (anchor / 'journal' / 'consumed').read_bytes() == b''
        return ok, 'an empty marker left by a crash mid-write still refuses, and is never repaired or removed'
    case('crash_before_write_completes_still_refuses', partial_marker)

    def concurrent():
        anchor = fresh(base, 'race')
        procs = [subprocess.Popen([sys.executable, '-I', str(Path(__file__).resolve()), '--child', str(anchor), 'exit'],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(8)]
        results = [p.communicate(timeout=60)[0].strip() for p in procs]
        return results.count('consumed') == 1 and results.count('refused') == 7, f'8 processes at once: {results.count("consumed")} consumed, {results.count("refused")} refused'
    case('eight_concurrent_processes_exactly_one_wins', concurrent)

    def acl(kind):
        def run():
            if not has('setfacl'): return False, 'setfacl missing (install the acl package)'
            anchor = fresh(base, f'acl-{kind}')
            target = anchor / 'journal'
            args = ['setfacl', '-m', 'u:nobody:rx', str(target)] if kind == 'access' else ['setfacl', '-d', '-m', 'u:nobody:rx', str(target)]
            r = subprocess.run(args, capture_output=True, text=True)
            if r.returncode != 0: return False, f'setfacl failed: {r.stderr.strip()[:200]}'
            os.chmod(target, 0o700)  # mode bits look right; only the ACL differs
            return refused(anchor) and marker(anchor) is None, f'real POSIX {kind} ACL on the journal refused before any marker'
        return run
    case('real_access_acl_refused', acl('access'))
    case('real_default_acl_refused', acl('default'))

    def wrong_mode():
        anchor = fresh(base, 'mode'); os.chmod(anchor / 'journal', 0o750)
        return refused(anchor) and marker(anchor) is None, 'group-readable journal refused'
    case('loose_permissions_refused', wrong_mode)

    def swapped():
        anchor = fresh(base, 'swap')
        b, deadline, fds = bind(anchor)
        os.rename(anchor / 'journal', anchor / 'journal-old'); (anchor / 'journal').mkdir(mode=0o700)
        try:
            M.consume_original_attempt(b, RAW, DIGEST, deadline); res = 'allowed'
        except M.AttemptUnavailable:
            res = 'refused'
        for fd in fds: os.close(fd)
        return res == 'refused' and marker(anchor) is None and not (anchor / 'journal-old' / 'consumed').exists(), f'journal replaced after binding: {res}'
    case('directory_swapped_after_binding_refused', swapped)

    if as_root:
        def root_owned():
            anchor = fresh(base, 'root')
            os.chown(anchor, 0, 0); os.chown(anchor / 'journal', 0, 0)
            g, fds = consume(anchor); m = marker(anchor)
            M.close_original_grant(g)
            for fd in fds: os.close(fd)
            return m['uid'] == 0 and m['bytes'] == RAW and refused(anchor), 'root:root 0700 journal: one consume, second refused'
        case('root_owned_journal', root_owned)

        def tmpfs():
            mnt = base / 'tmpfs'; mnt.mkdir()
            r = subprocess.run(['mount', '-t', 'tmpfs', '-o', 'size=8m,mode=0700', 'tmpfs', str(mnt)], capture_output=True, text=True)
            if r.returncode != 0: return False, f'mount failed: {r.stderr.strip()[:200]}'
            try:
                anchor = fresh(mnt, 'j')
                g, fds = consume(anchor); m = marker(anchor)
                M.close_original_grant(g)
                for fd in fds: os.close(fd)
                acl_ok = 'not tested'
                if has('setfacl'):
                    a2 = fresh(mnt, 'acl')
                    if subprocess.run(['setfacl', '-m', 'u:nobody:rx', str(a2 / 'journal')], capture_output=True).returncode == 0:
                        os.chmod(a2 / 'journal', 0o700)
                        acl_ok = 'refused' if refused(a2) else 'allowed'
                return m['bytes'] == RAW and refused(anchor) and acl_ok != 'allowed', f'tmpfs: consume once, second refused, ACL {acl_ok}'
            finally:
                subprocess.run(['umount', str(mnt)], capture_output=True)
        case('tmpfs_journal', tmpfs)
    return out


def main(argv):
    if len(argv) >= 3 and argv[0] == '--child':
        child(argv[1], argv[2]); return 0
    as_root = '--root' in argv
    receipt = argv[argv.index('--receipt') + 1] if '--receipt' in argv else None
    if platform.system() != 'Linux':
        print('This check runs only on a disposable Linux host.', file=sys.stderr); return 2
    if as_root and os.geteuid() != 0:
        print('--root needs root (sudo -n).', file=sys.stderr); return 2
    base = Path(tempfile.mkdtemp(prefix='axiom-gov-host-'))
    os.chmod(base, 0o700)
    try:
        results = scenarios(base, as_root)
    finally:
        subprocess.run(['umount', str(base / 'tmpfs')], capture_output=True) if as_root else None
        shutil.rmtree(base, ignore_errors=True)
    data = {
        'schema': 'axiom.governance-linux-host-check/1',
        'governanceEnabled': False,
        'scope': 'original-attempt journal primitive on a disposable host; not a protected installation, time/key custody, reviewer or fleet acceptance',
        'host': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine(), 'python': platform.python_version(), 'euid': os.geteuid(),
                 'os_release': Path('/etc/os-release').read_text().split('PRETTY_NAME=')[-1].split('\n')[0].strip('"') if Path('/etc/os-release').exists() else None},
        'source': {'scripts/governance_original_attempt.py': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                   'scripts/governance_linux_host_check.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        'cleanupConfirmed': not base.exists(),
        'results': results,
        'passed': all(r['passed'] for r in results) and not base.exists(),
    }
    text = json.dumps(data, indent=2)
    print(text)
    if receipt: Path(receipt).write_text(text + '\n')
    return 0 if data['passed'] else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
