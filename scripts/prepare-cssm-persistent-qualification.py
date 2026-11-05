"""Approved preparation only; no helper, fixture or controller execution."""
from pathlib import Path
import hashlib
import json
import os
import stat
import subprocess
import sys

LAB = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-04-v2')


def private_directory(path, parents=False, exist_ok=False):
    # File umask0177 intentionally removes executable bits; directories instead
    # need owner traversal. Restore the file mask even if mkdir refuses.
    previous = os.umask(0o077)
    try:
        path.mkdir(mode=0o700, parents=parents, exist_ok=exist_ok)
    finally:
        os.umask(previous)


def create_fresh_lab():
    # Inspect every existing ancestor before creating anything. No aliases/adoption.
    for ancestor in reversed(LAB.parents):
        if ancestor.is_symlink():
            raise ValueError('lab-ancestor-symlink')
        if ancestor.exists() and not ancestor.is_dir():
            raise ValueError('lab-ancestor-not-directory')
        if ancestor.exists() and ancestor.stat().st_uid not in (0, os.getuid()):
            raise ValueError('lab-ancestor-unowned')
    private_directory(LAB.parent, parents=True, exist_ok=True)
    private_directory(LAB)  # deliberately no exist_ok; even our old lab refuses
    if LAB.stat().st_uid != os.getuid() or stat.S_IMODE(LAB.stat().st_mode) != 0o700:
        raise ValueError('lab-not-private-owned')
    return LAB


def bind_owned_file(path):
    path = Path(path)
    if not path.is_absolute() or path.resolve(strict=True) != path:
        raise ValueError('file-alias')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_uid != os.getuid() or before.st_nlink != 1:
            raise ValueError('file-not-owned-single-regular')
        digest = hashlib.sha256()
        while True:
            block = os.read(fd, 65536)
            if not block:
                break
            digest.update(block)
        after = os.fstat(fd)
        fields = ('st_dev', 'st_ino', 'st_uid', 'st_gid', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
        def identity(value):
            return tuple(getattr(value, name) for name in fields)
        if identity(before) != identity(after) or identity(after) != identity(os.stat(path, follow_symlinks=False)):
            raise ValueError('file-changed')
        return dict(path=str(path), uid=after.st_uid, mode=stat.S_IMODE(after.st_mode),
                    dev=after.st_dev, ino=after.st_ino, size=after.st_size,
                    mtime_ns=after.st_mtime_ns, ctime_ns=after.st_ctime_ns,
                    sha256=digest.hexdigest())
    finally:
        os.close(fd)


def main():
    if len(sys.argv) != 1:
        raise ValueError('no-arguments-supported')
    os.umask(0o177)
    lab = create_fresh_lab()
    root = Path(__file__).resolve().parents[1]
    native = root / 'packages/verified-issuer-runtime/native'
    source = lab / 'source'
    private_directory(source)
    tests = lab / 'pure-tests'
    private_directory(tests)
    names = ['cssm_policy_builder.c', 'cssm_policy_copy.c', 'cssm_policy_copy.h',
             'cssm_policy_once.h', 'cssm_policy_inspect.c', 'cssm_policy_inspect.h',
             'cssm_policy_copy_test.c', 'cssm_policy_once_test.c', 'cssm_policy_inspect_test.c',
             'cssm_policy_qualification.c', 'cssm_policy_qualification_receipt.h',
             'cssm_policy_watchdog_test.py']
    for name in names:
        with (source / name).open('xb') as target:
            target.write((native / name).read_bytes())
    fingerprint_names = names[:6]
    fingerprint = hashlib.sha256(b''.join((source / name).read_bytes() for name in fingerprint_names)).hexdigest()
    revision = 'persistent-v2-e7e493d9'
    # Header has no self/hash cycle: only the six ordered source files are stamped.
    expected_header = ('/* Preparation provenance only; not authority or execution approval. */\n'
                       f'#define AX_QUAL_SOURCE_REVISION "{revision}"\n'
                       f'#define AX_QUAL_SOURCE_SHA256 "{fingerprint}"\n')
    if (source / 'cssm_policy_qualification_receipt.h').read_text() != expected_header:
        raise ValueError('source-stamp-not-current')
    commands = []
    def command(argv, timeout=30):
        # This function is used only with the explicit compiler/inspection/pure-test
        # lists below. Never helper/fixture/controller or any Security API call.
        result = subprocess.run(argv, cwd=source, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C',
                                'HOME': '/var/empty', 'TMPDIR': '/private/tmp'},
                                capture_output=True, timeout=timeout, text=True)
        commands.append(dict(argv=argv, exit=result.returncode, stdout=result.stdout, stderr=result.stderr))
        (lab / 'commands.json').write_text(json.dumps(commands, indent=2) + '\n')
        if result.returncode:
            raise RuntimeError('preparation-command-failed-no-automatic-retry')
        return result.stdout
    clang = command(['/usr/bin/xcrun', '--find', 'clang']).strip()
    compiler = command([clang, '--version'])
    sdk = command(['/usr/bin/xcrun', '--show-sdk-path']).strip()
    sdk_version = command(['/usr/bin/xcrun', '--show-sdk-version']).strip()
    flags = [clang, '-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-deprecated-declarations', '-isysroot', sdk]
    fixture = lab / 'pure-test'
    helper = lab / 'qualification-helper'
    command(flags + ['-fsanitize=address,undefined', 'cssm_policy_copy_test.c', 'cssm_policy_copy.c', '-o', str(fixture)])
    command(flags + ['-DAX_CSSM_PROFILE=1', 'cssm_policy_qualification.c', 'cssm_policy_copy.c',
                     'cssm_policy_inspect.c', '-framework', 'Security', '-framework', 'CoreFoundation', '-o', str(helper)])
    # Compile-only outputs are not run and remain nonexecutable. Clang's normal
    # platform linker behavior is retained; no codesign invocation is performed.
    fixture.chmod(0o600)
    helper.chmod(0o600)
    command(['/usr/bin/nm', '-u', str(helper)])
    command(['/usr/bin/otool', '-L', str(helper)])
    command(['/usr/bin/otool', '-L', str(fixture)])
    # Separate pure binaries, not the designated code-identity fixture or helper.
    for name, sources, extra in [
        ('copy', ['cssm_policy_copy_test.c', 'cssm_policy_copy.c'], []),
        ('inspect', ['cssm_policy_inspect_test.c', 'cssm_policy_copy.c', 'cssm_policy_inspect.c'], []),
        ('once', ['cssm_policy_once_test.c'], ['-pthread'])]:
        executable = tests / name
        command(flags + ['-fsanitize=address,undefined'] + sources + extra + ['-o', str(executable)])
        executable.chmod(0o700)
        command([str(executable)])
        executable.chmod(0o600)
    files = [bind_owned_file(source / name) for name in names] + [bind_owned_file(helper), bind_owned_file(fixture)]
    historical = json.loads((root / 'docs/recovery/2026-11-03/compiled-consumer-authority-bridge/in-memory-policy-qualification-manifest.compiled.json').read_text())
    packet = {**historical, 'source': 'persistent-v2-preparation-actualexecutionUNAUTHORIZED',
              'behavior_source_freeze': revision, 'execution_authorized': False, 'files': files,
              'build': dict(compiler=compiler, sdk_path=sdk, sdk_version=sdk_version, umask='0177',
                            helper_profile=1, canonical_profile_default=0, commands_file=str(lab / 'commands.json')),
              'source_fingerprint': {**historical['source_fingerprint'], 'sha256': fingerprint},
              'mode_transition': 'Future separately approved RUN only: helper0600->0700->0600; capture actual ctime. Fixture remains0600.'}
    packet_path = lab / 'qualification-manifest.json'
    with packet_path.open('x') as output:
        output.write(json.dumps(packet, indent=2) + '\n')
    packet_binding = bind_owned_file(packet_path)
    fixture_binding = files[-1]
    controller = (native / 'cssm_policy_watchdog.py').read_text()
    replacements = {
        '/private/tmp/axiom-cssm-policy-artifacts/qualification-manifest.json': str(packet_path),
        historical['files'][-2]['path']: str(helper),
        historical['files'][-1]['path']: str(fixture),
        '909cbd489d59046afe88e7e397de0d6e7b01fc0cd15471fd526e6178d46c91df': packet_binding['sha256'],
        historical['files'][-1]['sha256']: fixture_binding['sha256'],
        "fixture['uid'] != 501": f"fixture['uid'] != {fixture_binding['uid']}",
        "fixture['size'] != 138024": f"fixture['size'] != {fixture_binding['size']}",
        'ad8efae1-source-preparation': revision,
        historical['source_fingerprint']['sha256']: fingerprint,
    }
    for old, new in replacements.items():
        if controller.count(old) != 1:
            raise ValueError('controller-literal-count')
        controller = controller.replace(old, new)
    controller_path = lab / 'cssm_policy_watchdog.py'
    with controller_path.open('x') as output:
        output.write(controller)
    # Import only inert Python definitions for mocked/pure unit tests; no real
    # preflight, RUN, --help subprocess or helper/fixture load is performed.
    with (lab / 'cssm_policy_watchdog_test.py').open('x') as output:
        output.write((source / 'cssm_policy_watchdog_test.py').read_text())
    command(['/usr/bin/python3', '-B', '-m', 'unittest', 'discover', '-s', str(lab), '-p', 'cssm_policy_watchdog_test.py'])
    receipt = dict(lab=str(lab), packet=packet_binding, controller=bind_owned_file(controller_path),
                   helper=bind_owned_file(helper), fixture=bind_owned_file(fixture),
                   execution_authorized=False, helper_executed=False, fixture_executed=False,
                   security_calls_executed=False, canonical_gate_changed=False,
                   preparation_script=bind_owned_file(Path(__file__).resolve()))
    (lab / 'preparation-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
