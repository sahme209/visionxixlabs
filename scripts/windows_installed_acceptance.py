"""Reviewed Windows-only unsigned installed-candidate QA.

Only the original known owner/repository PR context and exact source may run.
This trusted fixed-source test is not hostile-code or installer-service isolation.
"""
from __future__ import annotations

import ctypes
import hashlib
import json
import ntpath
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys

# Local helper imports must never add bytecode to the frozen source inventory.
sys.dont_write_bytecode = True
import time
import uuid
from urllib.parse import urlsplit, unquote

EXPECTED_REF = "refs/heads/codex/watched-review-corrections"
EXPECTED_ACTOR = "sahme209"
# Managed-runner tools are observed at runtime, not assigned impossible pre-host hashes.
BUNDLER_RECIPE_REVIEWED = True
UPGRADE_CYCLES_INTEGRATED = True
REPOSITORY = "sahme209/visionxixlabs"
TOTAL_SECONDS = 2100
MAX_LOG_BYTES = 8 * 1024 * 1024
ROOT = Path(__file__).resolve().parent.parent
TARGET = "x86_64-pc-windows-msvc"
REVIEWED_MANIFEST = "docs/recovery/2026-11-15/windows-installed-preparation/REVIEWED-FILES.json"
V19_NSIS_TEMPLATE_SHA256 = "5179b482dc60961a42e9bc82509ba46c8c3c21d9f6235000d61214f6573117eb"
V19_MSI_TEMPLATE_SHA256 = "bdca7d5a2bb5a481c85fef58410c2aa00a1b6a2865bbbcd53b920abd471dc1e8"
LEGACY_MSI_UPGRADE_CODE = "a3c7da37-1792-51f2-8b3a-8848b1b33f88"
TOOL_NAMES = ("node.exe", "cargo.exe", "rustc.exe", "pwsh.exe", "msiexec.exe", "git.exe")


def source_members(paths, root):
    """Source-only manifest helper; caller supplies its reviewed staged path list."""
    need(isinstance(paths, list) and 0 < len(paths) <= 20000 and len(set(paths)) == len(paths), "source_inventory_invalid")
    result = {}
    for name in sorted(paths):
        need(isinstance(name, str) and name and "\\" not in name and not name.startswith("/")
             and all(part not in ("", ".", "..") for part in name.split("/")), "source_path_invalid")
        if name == REVIEWED_MANIFEST:
            continue  # Runtime manifest digest records custody of this one excluded file; it is not independent human-approval proof.
        path = root / name
        need(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve()), "source_member_invalid")
        result[name] = {"bytes": path.stat().st_size, "sha256": digest(path)}
    return result


def source_binding(env, event):
    """Ordinary same-repository PR custody, never human-approval evidence."""
    need(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_RUN_ATTEMPT') == '1', 'original_pr_attempt_required')
    need(env.get('GITHUB_REPOSITORY') == REPOSITORY and env.get('GITHUB_ACTOR') == EXPECTED_ACTOR, 'pr_actor_or_repository_changed')
    need(event.get('number') == 339 and env.get('GITHUB_REF') == 'refs/pull/339/merge', 'pr_changed')
    need(event.get('action') in ('opened','synchronize','reopened'), 'pr_event_changed')
    pr = event.get('pull_request', {})
    need(pr.get('number') == 339 and pr.get('user', {}).get('login') == EXPECTED_ACTOR, 'pr_owner_changed')
    for repo in (event.get('repository', {}), pr.get('head', {}).get('repo', {}), pr.get('base', {}).get('repo', {})):
        need(repo.get('id') == 1130181785 and repo.get('full_name') == REPOSITORY and repo.get('private') is False, 'public_original_repository_required')
    head, base = pr.get('head', {}), pr.get('base', {})
    need(head.get('ref') == 'codex/watched-review-corrections' and base.get('ref') == 'main', 'pr_branch_changed')
    sha = head.get('sha', '')
    need(isinstance(sha, str) and re.fullmatch(r'[a-f0-9]{40}', sha) is not None and env.get('AXIOM_QA_SOURCE_SHA') == sha, 'pr_source_changed')
    return {'sha':sha, 'sourceAuthority':'ordinary-owner-PR-CI', 'externalHumanApprovalProof':False}


def reviewed_manifest(binding, root):
    path = root / REVIEWED_MANIFEST
    need(path.is_file() and not path.is_symlink() and path.stat().st_size <= 8*1024*1024 and digest(path) == binding['manifestSha256'], "reviewed_manifest_changed")
    value = json.loads(path.read_text())
    need(set(value) == {'schema', 'files'} and value['schema'] == 'axiom.windows-reviewed-files/1' and isinstance(value['files'], dict), 'reviewed_manifest_invalid')
    required = {'scripts/windows_installed_acceptance.py', 'scripts/windows_installer_metadata.ps1', '.github/workflows/desktop-ci.yml', 'scripts/windows_upgrade_acceptance.py', 'scripts/windows_upgrade_snapshot.ps1', 'scripts/windows_shortcut_collision.ps1', 'scripts/windows_legacy_acquire.py', 'desktop/src-tauri/windows/installer.nsi', 'desktop/src-tauri/windows/main.wxs', 'desktop/src-tauri/windows/msi-shortcut-migration.vbs', 'scripts/windows_msi_shortcut_preflight.py', 'scripts/windows_residual_metadata.py', 'scripts/windows_residual_shortcuts.ps1', 'desktop/package-lock.json', 'desktop/src-tauri/Cargo.lock', 'desktop/src-tauri/tauri.conf.json', 'desktop/src-tauri/tests/windows_keyring_acceptance.rs'}
    need(required <= set(value['files']) and REVIEWED_MANIFEST not in value['files'], 'reviewed_manifest_incomplete')
    return value['files']


def supported_version(name, output):
    patterns = {'node.exe': r'v(24)\.(\d+)\.(\d+)', 'cargo.exe': r'cargo (1)\.(\d+)\.(\d+)(?: .*?)?', 'rustc.exe': r'rustc (1)\.(\d+)\.(\d+)(?: .*?)?', 'pwsh.exe': r'(7)\.(\d+)\.(\d+)', 'git.exe': r'git version (2)\.(\d+)\.(\d+)(?:\.windows\.\d+)?', 'python.exe': r'(3)\.(\d+)\.(\d+)', 'npm': r'(11)\.(\d+)\.(\d+)'}
    match = re.fullmatch(patterns[name], output.strip())
    need(match is not None, 'unsupported_managed_tool_version')
    version = tuple(map(int, match.groups()))
    need(name != 'node.exe' or version == (24,21,0), 'unsupported_managed_tool_version')
    floor = {'cargo.exe': (1,88,0), 'rustc.exe': (1,88,0), 'git.exe': (2,40,0), 'python.exe': (3,9,0)}.get(name, (0,0,0))
    need(version >= floor, 'unsupported_managed_tool_version')
    return '.'.join(map(str, version))


def runtime_tools():
    tools, evidence = {}, {}
    for name in TOOL_NAMES:
        found = shutil.which(name)
        need(found is not None, 'managed_tool_missing')
        path = Path(found).resolve(strict=True)
        need(path.is_file() and path.suffix.lower() == '.exe', 'managed_tool_invalid')
        if name == 'msiexec.exe':
            need(path == (Path(os.environ['SYSTEMROOT']) / 'System32/msiexec.exe').resolve(strict=True), 'windows_installer_path_changed')
        tools[name] = str(path)
        evidence[name] = {'path': str(path), 'sha256': digest(path)}
    python = Path(sys.executable).resolve(strict=True)
    tools['python.exe'] = str(python)
    evidence['python.exe'] = {'path': str(python), 'sha256': digest(python), 'version': supported_version('python.exe', '.'.join(map(str, sys.version_info[:3])))}
    return tools, evidence


def locked_tauri(root, installed=False):
    lock = json.loads((root / 'desktop/package-lock.json').read_text())
    packages = lock['packages']
    names = ('@tauri-apps/cli', '@tauri-apps/cli-win32-x64-msvc')
    proof = {}
    for name in names:
        row = packages['node_modules/' + name]
        need(row['version'] == '2.12.4' and isinstance(row.get('integrity'), str) and row['integrity'].startswith('sha512-')
             and row.get('resolved', '').startswith('https://registry.npmjs.org/' + name + '/-/'), 'tauri_lock_changed')
        proof[name] = {'version': row['version'], 'integrity': row['integrity']}
        if installed:
            folder = root / 'desktop/node_modules' / name
            need(json.loads((folder / 'package.json').read_text())['version'] == '2.12.4', 'installed_tauri_version_changed')
            filename = 'tauri.js' if name == names[0] else 'cli.win32-x64-msvc.node'
            payload = owned_file(folder / filename, folder)
            proof[name]['payloadSha256'] = digest(payload)
    return proof


MAX_BUNDLE_PAYLOAD_BYTES = 128 * 1024 * 1024
BUNDLE_TYPE_MARKER = b"__TAURI_BUNDLE_TYPE_VAR_UNK"
BUNDLE_TYPE_REPLACEMENTS = {'msi': b"__TAURI_BUNDLE_TYPE_VAR_MSI", 'nsis': b"__TAURI_BUNDLE_TYPE_VAR_NSS"}
BUNDLE_PATCH_PROVENANCE = {
    'version': '2.12.4',
    'bundlerSource': 'https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle.rs',
    'bundlerSourceSha256': '91c8387ccb2e52388cdcfeccfd23f69dac5439aba397d464b1d5446153fdc82e',
    'cliSource': 'https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.4/crates/tauri-cli/src/bundle.rs',
    'cliSourceSha256': 'fa883f16f84ad4a0d7d091daa2a57e177b804b481a9ec8f8227c5a398dcafdf6',
    'algorithm': 'first-UNK-marker-same-width-replacement-full-file-sha256',
}


def bundled_payload_expectations(payload, owned_root, installed_tauri):
    # This mirrors the pinned trusted bundler's normal per-format patch. It does
    # not normalize installed bytes or permit differences anywhere else.
    names = {'@tauri-apps/cli', '@tauri-apps/cli-win32-x64-msvc'}
    need(isinstance(installed_tauri, dict) and set(installed_tauri) == names, 'payload_patch_source_unqualified')
    for name in names:
        row = installed_tauri[name]
        need(isinstance(row, dict) and row.get('version') == '2.12.4' and isinstance(row.get('integrity'), str) and row['integrity'].startswith('sha512-') and isinstance(row.get('payloadSha256'), str) and re.fullmatch(r'[a-f0-9]{64}', row['payloadSha256']) is not None, 'payload_patch_source_unqualified')
    payload = owned_file(payload, owned_root)
    size = payload.stat().st_size
    need(0 < size <= MAX_BUNDLE_PAYLOAD_BYTES, 'payload_patch_size_refused')
    with payload.open('rb') as stream: raw = stream.read(MAX_BUNDLE_PAYLOAD_BYTES + 1)
    need(len(raw) == size, 'payload_changed_during_patch_inventory')
    offset = raw.find(BUNDLE_TYPE_MARKER)
    need(offset >= 0, 'payload_bundle_marker_missing')
    hashes = {}
    for kind, replacement in BUNDLE_TYPE_REPLACEMENTS.items():
        need(len(replacement) == len(BUNDLE_TYPE_MARKER), 'payload_bundle_marker_width_changed')
        patched = raw[:offset] + replacement + raw[offset+len(BUNDLE_TYPE_MARKER):]
        hashes[kind] = hashlib.sha256(patched).hexdigest()
    return {'rawInputSha256': hashlib.sha256(raw).hexdigest(), 'bytes':size,
            'markerOffset':offset, 'markerBytes':len(BUNDLE_TYPE_MARKER),
            'formatExpectedSha256':hashes, 'sourceProvenance':dict(BUNDLE_PATCH_PROVENANCE)}


def format_payload_hash(expected, kind):
    need(kind in ('msi', 'nsis') and isinstance(expected, dict) and set(expected) == {'msi','nsis'} and all(isinstance(value,str) and re.fullmatch(r'[a-f0-9]{64}',value) is not None for value in expected.values()), 'payload_format_expectation_invalid')
    return expected[kind]


def vendor_cache_snapshot(cache):
    files = sorted(path for path in cache.rglob('*') if path.is_file())
    need(0 < len(files) <= 2000 and all(not path.is_symlink() for path in files), 'vendor_cache_invalid')
    need((cache / 'WixTools314/candle.exe').is_file() and (cache / 'WixTools314/light.exe').is_file() and (cache / 'NSIS/makensis.exe').is_file(), 'vendor_tool_missing')
    return {str(path.relative_to(cache)).replace('\\', '/'): {'bytes': path.stat().st_size, 'sha256': digest(path)} for path in files}



def need(condition, code):
    if not condition:
        raise RuntimeError(code)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def source_snapshot(runner, tools):
    if getattr(runner, 'manifest_hash', None):
        need(digest(ROOT / REVIEWED_MANIFEST) == runner.manifest_hash, 'reviewed_manifest_changed')
    number = getattr(runner, 'source_reads', 0)
    runner.source_reads = number + 1
    text = runner.run(f"source-inventory-{number}", [tools['git.exe'], "ls-files", "-z", "--cached", "--others", "--exclude-standard"], ROOT, 15)
    paths = sorted(set(text.split("\0")) - {""})
    need(paths and len(paths) <= 20000, "source_inventory_invalid")
    return source_members(paths, ROOT)


def owned_file(path, parent):
    path, parent = Path(path), Path(parent)
    need(path.is_file() and not path.is_symlink(), "artifact_not_regular")
    need(path.resolve().is_relative_to(parent.resolve()), "artifact_outside_owned_root")
    return path


def windows_path_identity(value):
    need(isinstance(value, str) and 0 < len(value) <= 32767 and not any(ord(char) < 32 for char in value), 'windows_artifact_path_invalid')
    value = value.replace('/', '\\')
    if value.startswith('\\\\?\\'): value = value[4:]
    drive, tail = ntpath.splitdrive(value)
    need(re.fullmatch(r'[A-Za-z]:', drive) is not None and tail.startswith('\\') and ':' not in tail, 'windows_artifact_path_invalid')
    need(all(part not in ('.','..') and part == part.rstrip(' .') for part in tail.split('\\') if part), 'windows_artifact_path_invalid')
    return ntpath.normcase(ntpath.normpath(value))


def windows_path_within(path, parent):
    try:
        path, parent = windows_path_identity(str(path)), windows_path_identity(str(parent))
        return path != parent and ntpath.commonpath([path,parent]) == parent
    except (RuntimeError, ValueError):
        return False


def vault_artifact_diagnostics(rows, target_root):
    def text(value):
        return ''.join(char for char in value[:1024] if ord(char) >= 32) if isinstance(value,str) else None
    result = {'candidateCount':len(rows), 'expectedOwnedRoot':text(str(target_root)), 'candidates':[]}
    for row in rows[:2]:
        target = row.get('target', {}) if isinstance(row.get('target'),dict) else {}
        result['candidates'].append({'executable':text(row.get('executable')), 'manifestPath':text(row.get('manifest_path')), 'sourcePath':text(target.get('src_path')), 'targetName':text(target.get('name')), 'targetKinds':[text(value) for value in target.get('kind',[])[:4]] if isinstance(target.get('kind'),list) else None, 'profileTest':row.get('profile',{}).get('test') is True if isinstance(row.get('profile'),dict) else False, 'insideOwnedRoot':windows_path_within(row.get('executable',''),target_root)})
    return result


def select_vault_artifact(rows, target_root, manifest_path, source_path, version):
    need(len(rows) == 1, 'synthetic_vault_executable_ambiguous')
    row = rows[0]; target = row.get('target', {}); profile = row.get('profile', {})
    need(row.get('reason') == 'compiler-artifact' and isinstance(target,dict) and target.get('name') == 'windows_keyring_acceptance' and target.get('kind') == ['test'] and target.get('crate_types') == ['bin'] and target.get('test') is True and isinstance(profile,dict) and profile.get('test') is True, 'synthetic_vault_artifact_target_mismatch')
    need(windows_path_identity(row.get('manifest_path')) == windows_path_identity(str(manifest_path)) and windows_path_identity(target.get('src_path')) == windows_path_identity(str(source_path)), 'synthetic_vault_artifact_source_mismatch')
    package = row.get('package_id')
    need(isinstance(package,str) and len(package) <= 4096 and package.startswith('path+file:'), 'synthetic_vault_package_mismatch')
    parsed = urlsplit(package[5:]); package_path = unquote(parsed.path)
    if re.match(r'^/[A-Za-z]:/',package_path): package_path = package_path[1:]
    need(not parsed.netloc and not parsed.query and parsed.fragment == 'axiom-desktop@'+version and windows_path_identity(package_path) == windows_path_identity(ntpath.dirname(str(manifest_path))), 'synthetic_vault_package_mismatch')
    executable = row.get('executable'); names = row.get('filenames')
    need(isinstance(executable,str) and windows_path_within(executable,target_root), 'artifact_outside_owned_root')
    need(re.fullmatch(r'windows_keyring_acceptance(?:-[a-f0-9]{1,64})?\.exe', ntpath.basename(executable), flags=re.I) is not None, 'synthetic_vault_executable_name_invalid')
    need(isinstance(names,list) and 0 < len(names) <= 32 and all(isinstance(name,str) and windows_path_within(name,target_root) for name in names) and sum(windows_path_identity(name) == windows_path_identity(executable) for name in names) == 1, 'synthetic_vault_executable_provenance_mismatch')
    return executable


def owned_vault_file(path, parent):
    path, parent = Path(path), Path(parent)
    need(parent.is_dir() and not parent.is_symlink() and path.is_file() and not path.is_symlink(), 'artifact_not_regular')
    actual, root = path.resolve(strict=True), parent.resolve(strict=True)
    inside = windows_path_within(actual,root) if os.name == 'nt' else actual.is_relative_to(root) and actual != root
    need(inside, 'artifact_outside_owned_root')
    require_pe_role(actual, 'Application')
    return actual


def installers(bundle):
    result = {}
    for kind in ["msi", "nsis"]:
        extension = "*.msi" if kind == "msi" else "*.exe"
        found = list((bundle / kind).glob(extension))
        need(len(found) == 1, "installer_count_invalid")
        result[kind] = owned_file(found[0], bundle)
    return result


def child_environment(inherited, extra=None):
    names = ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "RUNNER_TEMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "HOME", "CARGO_HOME", "RUSTUP_HOME", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "COMSPEC", "PATHEXT"]
    inherited = {name.upper(): value for name, value in inherited.items()}
    env = {name: inherited[name] for name in names if name in inherited}
    if "RUNNER_TEMP" in env:
        env["RUNNER_TEMP"] = windows_path_identity(env["RUNNER_TEMP"])
    env.update({"CI": "1", "NO_COLOR": "1", "PYTHONDONTWRITEBYTECODE": "1"})
    if extra:
        need(set(extra) <= {"AXIOM_WINDOWS_ACCEPTANCE_KEY", "AXIOM_WINDOWS_ACCEPTANCE_STAGE"}, "extra_environment_refused")
        env.update(extra)
    return env


def pe_machine(path):
    with path.open("rb") as file:
        need(file.read(2) == b"MZ", "installed_pe_header_invalid")
        file.seek(0x3c); raw = file.read(4)
        need(len(raw) == 4, "installed_pe_offset_invalid")
        offset = int.from_bytes(raw, "little")
        need(64 <= offset <= 1048576, "installed_pe_offset_invalid")
        file.seek(offset); need(file.read(4) == b"PE\0\0", "installed_pe_signature_invalid")
        raw = file.read(2); need(len(raw) == 2, "installed_pe_machine_missing")
        return int.from_bytes(raw, "little")


def require_pe_role(path, artifact_kind):
    expected = {'NsisInstaller':0x14c, 'Application':0x8664}
    need(artifact_kind in expected and pe_machine(path) == expected[artifact_kind], 'artifact_pe_role_mismatch')
    return 'I386' if artifact_kind == 'NsisInstaller' else 'AMD64'


def authority():
    need(all([EXPECTED_REF, EXPECTED_ACTOR]) and BUNDLER_RECIPE_REVIEWED and UPGRADE_CYCLES_INTEGRATED, "acceptance_not_enrolled")
    from windows_upgrade_acceptance import UPGRADE_RECIPE_REVIEWED
    need(UPGRADE_RECIPE_REVIEWED, "upgrade_recipe_not_reviewed")
    need(os.name == "nt", "windows_only")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    binding = source_binding(os.environ, event)
    manifest = ROOT / REVIEWED_MANIFEST
    need(manifest.is_file() and not manifest.is_symlink(), 'reviewed_manifest_missing')
    # Record/verify custody; this digest is NOT a circular workflow-embedded
    # claim that GitHub's selected head is independently human-approved.
    binding['manifestSha256'] = digest(manifest)
    return binding


def bounded_stream_diagnostics(path):
    """Preserve the existing prefix; add at most4KiB of nonoverlapping tail."""
    size=path.stat().st_size
    clean=lambda value: ''.join(c for c in value.decode('utf-8',errors='replace') if c in '\n\r\t' or ord(c)>=32)
    with path.open('rb') as file:
        prefix=file.read(2048)
        result={'sha256':digest(path),'bytes':size,'text':clean(prefix),'prefixTruncated':size>len(prefix)}
        if result['prefixTruncated']:
            offset=max(len(prefix),size-4096)
            file.seek(offset);tail=file.read(4096)
            result['tailText']=clean(tail)
            result['tailOffsetBytes']=offset
            result['tailBytes']=len(tail)
    return result


class OwnedWindowsProcess:
    """Create suspended, assign an owned kill-on-close Job, then resume.

    Windows Installer's system service is outside this Job: uninstall/product
    verification is an additional explicit gate, not a process-containment claim.
    """
    def __init__(self, output, deadline):
        self.output, self.deadline, self.records = output, deadline, []

    def run(self, label, args, cwd, limit, extra=None, observe_window=False, allow=(0,), extra_logs=()):
        from ctypes import wintypes as W
        import msvcrt
        need(os.name == "nt" and label.replace("-", "").isalnum(), "invalid_windows_command")
        command_deadline = phase_deadline(self.deadline, time.monotonic(), limit)
        program = shutil.which(str(args[0]))
        need(program and Path(program).suffix.lower() == ".exe", "fixed_executable_unavailable")
        k = ctypes.WinDLL("kernel32", use_last_error=True)
        class SI(ctypes.Structure):
            _fields_ = [("cb", W.DWORD), ("lpReserved", W.LPWSTR), ("lpDesktop", W.LPWSTR), ("lpTitle", W.LPWSTR), ("dwX", W.DWORD), ("dwY", W.DWORD), ("dwXSize", W.DWORD), ("dwYSize", W.DWORD), ("dwXCountChars", W.DWORD), ("dwYCountChars", W.DWORD), ("dwFillAttribute", W.DWORD), ("dwFlags", W.DWORD), ("wShowWindow", W.WORD), ("cbReserved2", W.WORD), ("lpReserved2", ctypes.c_void_p), ("hStdInput", W.HANDLE), ("hStdOutput", W.HANDLE), ("hStdError", W.HANDLE)]
        class PI(ctypes.Structure):
            _fields_ = [("hProcess", W.HANDLE), ("hThread", W.HANDLE), ("dwProcessId", W.DWORD), ("dwThreadId", W.DWORD)]
        class BASIC(ctypes.Structure):
            _fields_ = [("ProcessUser", ctypes.c_int64), ("JobUser", ctypes.c_int64), ("Flags", W.DWORD), ("MinWorking", ctypes.c_size_t), ("MaxWorking", ctypes.c_size_t), ("ActiveLimit", W.DWORD), ("Affinity", ctypes.c_size_t), ("Priority", W.DWORD), ("Scheduling", W.DWORD)]
        class EXTENDED(ctypes.Structure):
            _fields_ = [("Basic", BASIC), ("IO", ctypes.c_uint64 * 6), ("ProcessMemory", ctypes.c_size_t), ("JobMemory", ctypes.c_size_t), ("PeakProcessMemory", ctypes.c_size_t), ("PeakJobMemory", ctypes.c_size_t)]
        class ACCOUNTING(ctypes.Structure):
            _fields_ = [("User", ctypes.c_int64), ("Kernel", ctypes.c_int64), ("PeriodUser", ctypes.c_int64), ("PeriodKernel", ctypes.c_int64), ("PageFaults", W.DWORD), ("TotalProcesses", W.DWORD), ("ActiveProcesses", W.DWORD), ("TerminatedProcesses", W.DWORD)]
        k.CreateJobObjectW.argtypes = [ctypes.c_void_p, W.LPCWSTR]; k.CreateJobObjectW.restype = W.HANDLE
        k.SetInformationJobObject.argtypes = [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD]; k.SetInformationJobObject.restype = W.BOOL
        k.AssignProcessToJobObject.argtypes = [W.HANDLE, W.HANDLE]; k.AssignProcessToJobObject.restype = W.BOOL
        k.CreateProcessW.argtypes = [W.LPCWSTR, W.LPWSTR, ctypes.c_void_p, ctypes.c_void_p, W.BOOL, W.DWORD, ctypes.c_void_p, W.LPCWSTR, ctypes.POINTER(SI), ctypes.POINTER(PI)]; k.CreateProcessW.restype = W.BOOL
        k.ResumeThread.argtypes = [W.HANDLE]; k.ResumeThread.restype = W.DWORD
        k.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]; k.WaitForSingleObject.restype = W.DWORD
        k.GetExitCodeProcess.argtypes = [W.HANDLE, ctypes.POINTER(W.DWORD)]; k.GetExitCodeProcess.restype = W.BOOL
        k.TerminateProcess.argtypes = [W.HANDLE, W.UINT]; k.TerminateProcess.restype = W.BOOL
        k.TerminateJobObject.argtypes = [W.HANDLE, W.UINT]; k.TerminateJobObject.restype = W.BOOL
        k.QueryInformationJobObject.argtypes = [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD, ctypes.c_void_p]; k.QueryInformationJobObject.restype = W.BOOL
        k.CloseHandle.argtypes = [W.HANDLE]; k.CloseHandle.restype = W.BOOL
        env = child_environment(os.environ, extra)
        environment = ctypes.create_unicode_buffer("\0".join(f"{name}={env[name]}" for name in sorted(env)) + "\0\0")
        out, err = self.output / f"{label}.stdout", self.output / f"{label}.stderr"
        need(all(Path(path).parent == self.output and not Path(path).exists() for path in extra_logs), "extra_log_scope_invalid")
        def output_bytes():
            return sum(path.stat().st_size for path in [out, err, *map(Path, extra_logs)] if path.exists())
        info, process, job = SI(), PI(), k.CreateJobObjectW(None, None)
        need(job, "job_unavailable")
        limits = EXTENDED(); limits.Basic.Flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        assigned = False
        record = {"label": label, "executableSha256": digest(Path(program)), "exitCode": None, "ownedJobEmpty": False, "windowObservation": None}
        self.records.append(record)
        try:
            need(k.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)), "job_limit_unavailable")
            with open("NUL", "rb") as stdin, out.open("xb") as stdout, err.open("xb") as stderr:
                handles = [msvcrt.get_osfhandle(file.fileno()) for file in [stdin, stdout, stderr]]
                for handle in handles: os.set_handle_inheritable(handle, True)
                info.cb = ctypes.sizeof(info); info.dwFlags = 0x100
                info.hStdInput, info.hStdOutput, info.hStdError = handles
                try:
                    line = ctypes.create_unicode_buffer(subprocess.list2cmdline([program, *map(str, args[1:])]))
                    remaining_milliseconds(command_deadline, time.monotonic())
                    need(k.CreateProcessW(program, line, None, None, True, 0x4 | 0x400, environment, str(cwd), ctypes.byref(info), ctypes.byref(process)), "process_creation_failed")
                finally:
                    for handle in handles: os.set_handle_inheritable(handle, False)
                need(k.AssignProcessToJobObject(job, process.hProcess), "owned_job_assignment_failed")
                assigned = True
                remaining_milliseconds(command_deadline, time.monotonic())
                need(k.ResumeThread(process.hThread) != 0xFFFFFFFF, "process_resume_failed")
                while k.WaitForSingleObject(process.hProcess, 100) == 0x102:
                    remaining_milliseconds(command_deadline, time.monotonic())
                    need(output_bytes() <= MAX_LOG_BYTES, "command_output_cap_exceeded")
                    if observe_window:
                        windows = self.visible_windows(process.dwProcessId)
                        if windows:
                            record["windowObservation"] = {"topLevelVisible": True, "titles": windows, "webviewRendered": "UNVERIFIED", "visualAcceptance": "UNVERIFIED"}
                            break
                if observe_window:
                    need(record["windowObservation"], "native_top_level_window_unobserved")
                else:
                    code = W.DWORD(); need(k.GetExitCodeProcess(process.hProcess, ctypes.byref(code)), "exit_unavailable")
                    record["exitCode"] = code.value
                    need(code.value in allow, "command_failed")
                remaining_milliseconds(command_deadline, time.monotonic())
                need(output_bytes() <= MAX_LOG_BYTES, "command_output_cap_exceeded")
        finally:
            cleanup_deadline = time.monotonic() + 5
            if process.hProcess:
                if assigned: k.TerminateJobObject(job, 1)
                else: k.TerminateProcess(process.hProcess, 1)  # still suspended
                k.WaitForSingleObject(process.hProcess, max(0, int((cleanup_deadline - time.monotonic()) * 1000)))
            if assigned:
                while time.monotonic() < cleanup_deadline:
                    accounting = ACCOUNTING()
                    if k.QueryInformationJobObject(job, 1, ctypes.byref(accounting), ctypes.sizeof(accounting), None) and accounting.ActiveProcesses == 0:
                        record["ownedJobEmpty"] = True; break
                    time.sleep(min(.05, max(0, cleanup_deadline - time.monotonic())))
            for handle in [process.hThread, process.hProcess, job]:
                if handle: k.CloseHandle(handle)
            # A fast producer can overshoot between polls. Retain at most the
            # same fixed cap after owned processes stop, with explicit truncation
            # metadata; never load an oversized diagnostic into memory.
            retained = MAX_LOG_BYTES
            record["logRetention"] = []
            for path in [out, err, *map(Path, extra_logs)]:
                if path.is_file():
                    size = path.stat().st_size
                    keep = min(size, retained)
                    if keep != size:
                        with path.open("r+b") as file: file.truncate(keep)
                    record["logRetention"].append({"name": path.name, "observedBytes": size, "retainedBytes": keep, "truncated": keep != size})
                    retained -= keep
            record["stdoutBytes"] = out.stat().st_size if out.exists() else 0
            record["stderrBytes"] = err.stat().st_size if err.exists() else 0
            record["diagnostics"] = {}
            for stream, path in [('stdout', out), ('stderr', err)]:
                if path.is_file():
                    record['diagnostics'][stream] = bounded_stream_diagnostics(path)
            from windows_residual_metadata import bounded_msi_log_tail
            record["extraLogs"] = [{"name": Path(path).name, "bytes": Path(path).stat().st_size, "sha256": digest(Path(path)), **bounded_msi_log_tail(path)} for path in extra_logs if Path(path).is_file()]
        need(record["ownedJobEmpty"], "owned_process_cleanup_unconfirmed")
        return out.read_text(encoding="utf-8-sig", errors="strict").strip()

    @staticmethod
    def visible_windows(pid):
        from ctypes import wintypes as W
        user = ctypes.WinDLL("user32", use_last_error=True)
        user.IsWindowVisible.argtypes = [W.HWND]; user.IsWindowVisible.restype = W.BOOL
        user.GetWindowThreadProcessId.argtypes = [W.HWND, ctypes.POINTER(W.DWORD)]; user.GetWindowThreadProcessId.restype = W.DWORD
        user.GetWindowTextW.argtypes = [W.HWND, W.LPWSTR, ctypes.c_int]; user.GetWindowTextW.restype = ctypes.c_int
        titles = []
        callback_type = ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
        @callback_type
        def callback(window, _):
            owner = W.DWORD(); user.GetWindowThreadProcessId(window, ctypes.byref(owner))
            if owner.value == pid and user.IsWindowVisible(window):
                title = ctypes.create_unicode_buffer(256); user.GetWindowTextW(window, title, 256)
                titles.append(title.value)
            return True
        user.EnumWindows.argtypes = [callback_type, W.LPARAM]; user.EnumWindows.restype = W.BOOL
        need(user.EnumWindows(callback, 0), "window_inventory_failed")
        return titles


def phase_deadline(shared, now, limit):
    end = min(shared, now + limit)
    remaining_milliseconds(end, now)
    return end


def remaining_milliseconds(end, now):
    need(end > now, "command_deadline_exceeded")
    return max(1, int((end - now) * 1000))


def msi_absent(state):
    need(state == -1, "msi_product_not_absent")  # INSTALLSTATE_UNKNOWN only
    return True


def protocol_args_match(args, executable):
    expected = ntpath.normcase(ntpath.normpath(str(executable)))
    return (len(args) == 2 and args[1] == '%1' and ntpath.isabs(args[0])
            and ntpath.normcase(ntpath.normpath(args[0])) == expected)


def parse_windows_command(value):
    from ctypes import wintypes as W
    shell = ctypes.WinDLL('shell32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    shell.CommandLineToArgvW.argtypes = [W.LPCWSTR, ctypes.POINTER(ctypes.c_int)]
    shell.CommandLineToArgvW.restype = ctypes.POINTER(W.LPWSTR)
    kernel.LocalFree.argtypes = [ctypes.c_void_p];kernel.LocalFree.restype = ctypes.c_void_p
    count = ctypes.c_int()
    pointer = shell.CommandLineToArgvW(value, ctypes.byref(count))
    need(pointer and 0 < count.value <= 16, 'protocol_command_invalid')
    try:return [pointer[i] for i in range(count.value)]
    finally:kernel.LocalFree(pointer)


def admit_vault(runner, args, extra, cwd):
    # Existing synthetic targets refuse before final cleanup is armed.
    runner.run('vault-preflight', [*args, 'acceptance_vault_stage', '--nocapture'], cwd, 15,
               {**extra, 'AXIOM_WINDOWS_ACCEPTANCE_STAGE': 'preflight'})


def primary_receipt(receipt):
    text = json.dumps(receipt, sort_keys=True)
    if len(text.encode()) > 1024 * 1024:
        return json.dumps({'accepted': False, 'failureCode': 'receipt_output_limit', 'published': False})
    return text


WEBVIEW_CLIENT = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
WEBVIEW_NATIVE_KEY = r'SOFTWARE\Microsoft\EdgeUpdate\Clients' + '\\' + WEBVIEW_CLIENT
WEBVIEW_WOW_KEY = r'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients' + '\\' + WEBVIEW_CLIENT


def validate_webview_configuration(config, root=None):
    windows = config.get('bundle', {}).get('windows', {})
    mode = windows.get('webviewInstallMode', {'type': 'downloadBootstrapper'})
    template = windows.get('nsis', {}).get('template')
    if template is not None:
        need(template == 'windows/installer.nsi' and root is not None, 'unreviewed_webview_configuration')
        path = root / 'desktop/src-tauri/windows/installer.nsi'
        need(path.is_file() and not path.is_symlink() and digest(path) == V19_NSIS_TEMPLATE_SHA256, 'unreviewed_webview_configuration')
    msi_template = windows.get('wix', {}).get('template')
    if msi_template is not None:
        need(msi_template == 'windows/main.wxs' and root is not None, 'unreviewed_webview_configuration')
        path = root / 'desktop/src-tauri/windows/main.wxs'
        need(path.is_file() and not path.is_symlink() and digest(path) == V19_MSI_TEMPLATE_SHA256, 'unreviewed_webview_configuration')
    need(mode in ({'type': 'downloadBootstrapper'}, {'type': 'downloadBootstrapper', 'silent': True})
         and windows.get('minimumWebview2Version') is None
         and windows.get('nsis', {}).get('installerHooks') is None,
         'unreviewed_webview_configuration')


def require_webview_runtime(registry=None):
    # Both x64 installers use the64-bit registry view: WiX defaults
    # RegistrySearch to the candle -arch x64 target; NSIS SetContext uses64.
    # NSIS requires the explicit WOW6432Node machine key or per-user key.
    if registry is None:
        import winreg as registry
    queries = [
        ('system-wow64', registry.HKEY_LOCAL_MACHINE, WEBVIEW_WOW_KEY, registry.KEY_WOW64_64KEY),
        ('system-native64', registry.HKEY_LOCAL_MACHINE, WEBVIEW_NATIVE_KEY, registry.KEY_WOW64_64KEY),
        ('user64', registry.HKEY_CURRENT_USER, WEBVIEW_NATIVE_KEY, registry.KEY_WOW64_64KEY),
    ]
    versions = {}
    for label, hive, path, view in queries:
        try:
            with registry.OpenKey(hive, path, 0, registry.KEY_READ | view) as key:
                value, kind = registry.QueryValueEx(key, 'pv')
        except FileNotFoundError:
            continue
        except OSError:
            raise RuntimeError('webview_registry_read_unavailable') from None
        need(kind == registry.REG_SZ and isinstance(value, str) and len(value) <= 64
             and re.fullmatch(r'[0-9]{1,5}(?:\.[0-9]{1,5}){3}', value) is not None
             and int(value.split('.')[0]) > 0, 'webview_runtime_version_unknown')
        versions[label] = value
    msi = bool(versions)
    nsis = any(label in versions for label in ('system-wow64', 'user64'))
    need(msi and nsis, 'webview_runtime_missing')
    return {'msiSeesInstalledRuntime': msi, 'nsisSeesInstalledRuntime': nsis,
            'clientId': WEBVIEW_CLIENT, 'versions': versions,
            'runtimeInstallationPermitted': False, 'webviewRenderingVerified': False}


def validated_runner_temp(value):
    # Independently bind the actual local runner directory before creating an
    # owner root or forwarding this nonsecret field to fixed helper children.
    identity = windows_path_identity(value)
    path = Path(value)
    need(path.is_dir() and not path.is_symlink(), 'runner_temp_not_regular_directory')
    actual = path.resolve(strict=True)
    need(windows_path_identity(str(actual)) == identity, 'runner_temp_resolved_identity_changed')
    return Path(identity)


def snapshot_helper_preflight(runner, tools, base):
    from windows_upgrade_acceptance import absent_before_owned_cycle
    directory = base / 'snapshot-preflight'
    directory.mkdir(exist_ok=False)
    need(not any(directory.iterdir()), 'snapshot_preflight_directory_not_empty')
    state = upgrade_snapshot(runner, tools, base, [directory], [], 'helper-snapshot-preflight')
    absent_before_owned_cycle(state)
    need(not any(directory.iterdir()), 'snapshot_preflight_directory_changed')
    return {'readOnly':True, 'ownedEmptyDirectoryMatched':True, 'knownProductGuidsIncluded':False}


def main():
    binding = authority()
    need(os.environ.get("ImageOS") == "win22", "standard_windows_2022_required")
    runner_temp = validated_runner_temp(os.environ.get("RUNNER_TEMP"))
    tools, tool_evidence = runtime_tools()
    cache = Path(os.environ['LOCALAPPDATA']) / 'tauri'
    need(not cache.exists(), 'existing_vendor_cache_refused')
    # Refuse any existing installation/data: this batch may never read an
    # operator's previous Axiom state. Standard runner must be a fresh VM.
    for name in ["APPDATA", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"]:
        if os.environ.get(name):
            for leaf in ["com.visionxixlabs.axiom", "Axiom Agent", "V19"]:
                need(not (Path(os.environ[name]) / leaf).exists(), "existing_axiom_state_refused")
    need(not protocol_state(), "existing_axiom_protocol_refused")
    base = runner_temp / ("axiom-installed-" + uuid.uuid4().hex)
    need(" " not in str(base), "nsis_fixed_argument_path_requires_no_spaces")
    base.mkdir(exist_ok=False)
    output = base / "evidence"; output.mkdir()
    runner = OwnedWindowsProcess(output, time.monotonic() + TOTAL_SECONDS)
    key = f"owned-roundtrip-{os.getpid()}-{time.time_ns()}"
    receipt = {"schema": "axiom.windows-installed-validation/1", "source": binding["sha"], "sourceBinding": binding, "managedTools": tool_evidence, "toolTrust": "managed-runner-operational-not-hermetic", "accepted": False, "unsignedValidationOnly": True, "published": False, "signingPerformed": False, "keyringCleanupConfirmed": False, "installations": [], "processes": runner.records, "uiVisualAcceptance": "UNVERIFIED", "googlePairing": "NOT_RUN", "productionVaultEntries": "NOT_USED_BY_SYNTHETIC_HARNESS", "installerServiceContained": False, "upgradeAcceptance": "NOT_RUN", "completeWindowsInstalledAcceptance": False}
    manifest = "desktop/src-tauri/Cargo.toml"
    vault_args = None
    vault_executable_hash = None
    vault_started = False
    try:
        head = runner.run("source-head", [tools["git.exe"], "rev-parse", "HEAD"], ROOT, 10)
        need(head == binding["sha"], "checkout_changed")
        frozen = reviewed_manifest(binding, ROOT)
        runner.manifest_hash = binding["manifestSha256"]
        need(source_snapshot(runner, tools) == frozen, "reviewed_source_changed")
        receipt["tauriLock"] = locked_tauri(ROOT)
        (output / "SOURCE-INPUTS.json").write_text(json.dumps(frozen, sort_keys=True))
        configuration = ROOT / 'desktop/src-tauri'
        need(not json.loads((configuration / 'tauri.conf.json').read_text()).get('bundle', {}).get('useLocalToolsDir', False), 'unreviewed_vendor_cache_configuration')
        need(not any((configuration / name).exists() for name in ['tauri.windows.conf.json', 'tauri.windows.conf.json5', 'Tauri.windows.toml']), 'unreviewed_webview_configuration')
        validate_webview_configuration(json.loads((configuration / 'tauri.conf.json').read_text()), ROOT)
        need(json.loads((configuration / 'tauri.conf.json').read_text()).get('productName') == 'V19', 'product_name_changed')
        need(json.loads((configuration / 'tauri.conf.json').read_text()).get('bundle', {}).get('windows', {}).get('wix', {}).get('upgradeCode') == LEGACY_MSI_UPGRADE_CODE, 'legacy_upgrade_identity_changed')
        receipt['webviewRuntimePreflight'] = require_webview_runtime()
        receipt['snapshotHelperPreflight'] = snapshot_helper_preflight(runner, tools, base)
        receipt['msiShortcutScriptPreflight'] = json.loads(runner.run('msi-shortcut-script-preflight', [tools['python.exe'], ROOT / 'scripts/windows_msi_shortcut_preflight.py', base / 'msi-shortcut-script'], ROOT, 60))
        need(receipt['msiShortcutScriptPreflight'].get('accepted') is True, 'msi_shortcut_script_preflight_refused')
        for name in ["node.exe", "cargo.exe", "rustc.exe", "pwsh.exe", "git.exe"]:
            args = [tools[name], "--version"] if name != "pwsh.exe" else [tools[name], "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"]
            version = runner.run("tool-" + name.split(".")[0], args, ROOT, 15)
            tool_evidence[name]["version"] = supported_version(name, version)
        npm = Path(tools["node.exe"]).parent / "node_modules/npm/bin/npm-cli.js"
        need(npm.is_file(), "setup_node_npm_cli_missing")
        tool_evidence['npm'] = {'path': str(npm.resolve()), 'sha256': digest(npm), 'version': supported_version('npm', runner.run('tool-npm', [tools['node.exe'], npm, '--version'], ROOT, 15))}
        tool_evidence['msiexec.exe']['version'] = runner.run('tool-msiexec', [tools['pwsh.exe'], '-NoProfile', '-NonInteractive', '-Command', "(Get-Item -LiteralPath (Join-Path $env:SYSTEMROOT 'System32/msiexec.exe')).VersionInfo.FileVersion"], ROOT, 15)
        need(re.fullmatch(r'[0-9.]+(?: \(.*\))?', tool_evidence['msiexec.exe']['version']) is not None, 'windows_installer_version_unknown')
        runner.run("desktop-dependencies", [tools["node.exe"], npm, "ci"], ROOT / "desktop", 300)
        need(source_snapshot(runner, tools) == frozen, "source_changed_after_dependencies")
        receipt["installedTauri"] = locked_tauri(ROOT, installed=True)
        runner.run("frontend", [tools["node.exe"], npm, "run", "build"], ROOT / "desktop", 300)
        vault_target = base / 'vault-target'
        need(not vault_target.exists(), 'vault_target_not_fresh')
        vault_target.mkdir(exist_ok=False)
        receipt['syntheticVaultOwnedTarget'] = str(vault_target)
        build = runner.run("vault-build", [tools["cargo.exe"], "test", "--manifest-path", manifest, "--locked", "--target-dir", vault_target, "--test", "windows_keyring_acceptance", "--no-run", "--message-format=json"], ROOT, 600)
        artifacts = []
        for line in build.splitlines():
            value = json.loads(line)
            if value.get("reason") == "compiler-artifact" and value.get("target", {}).get("name") == "windows_keyring_acceptance" and value.get("executable"):
                artifacts.append(value)
        # Persist the bounded selected metadata before any provenance/refusal so
        # a changed toolchain cannot hide the selected path in a stdout prefix.
        receipt['syntheticVaultArtifactSelection'] = vault_artifact_diagnostics(artifacts, vault_target)
        expected_version = json.loads((ROOT / 'desktop/package.json').read_text())['version']
        selected = select_vault_artifact(artifacts, vault_target, ROOT / manifest, ROOT / 'desktop/src-tauri/tests/windows_keyring_acceptance.rs', expected_version)
        vault_executable = owned_vault_file(selected, vault_target)
        vault_executable_hash = digest(vault_executable)
        receipt["syntheticVaultExecutableSha256"] = vault_executable_hash
        vault_args = [vault_executable, "--ignored", "--exact"]
        need(source_snapshot(runner, tools) == frozen, "source_changed_after_vault_build")
        admit_vault(runner, vault_args, {"AXIOM_WINDOWS_ACCEPTANCE_KEY": key}, ROOT)
        vault_started = True
        runner.run("vault-roundtrip", [*vault_args, "windows_credential_persists_across_processes", "--nocapture"], ROOT, 60, {"AXIOM_WINDOWS_ACCEPTANCE_KEY": key})
        # Standard frontend/native CI remains the preceding qualification gate.
        # This command creates candidate installers only; no release API/token.
        tauri = ROOT / "desktop/node_modules/@tauri-apps/cli/tauri.js"
        need(tauri.is_file(), "locked_tauri_cli_missing")
        receipt['webviewRuntimeBeforeBundle'] = require_webview_runtime()
        need(not cache.exists(), 'existing_vendor_cache_refused')
        runner.run("unsigned-bundle", [tools["node.exe"], tauri, "build", "--target", TARGET, "--bundles", "msi,nsis", "--ci", "--", "--locked"], ROOT / "desktop", 900)
        need(source_snapshot(runner, tools) == frozen, "source_changed_after_bundle")
        receipt["acquiredVendorFiles"] = vendor_cache_snapshot(cache)
        receipt["vendorAcquisition"] = "fresh-cache-locked-tauri-upstream-checksums-not-independent-origin-proof"
        version = json.loads((ROOT / "desktop/package.json").read_text())["version"]
        receipt["version"] = version
        payload = owned_file(ROOT / "desktop/src-tauri/target" / TARGET / "release/axiom-desktop.exe", ROOT / "desktop/src-tauri/target" / TARGET / "release")
        need(pe_machine(payload) == 0x8664, "built_payload_not_windows_x64")
        payload_hash = digest(payload)
        receipt["builtPayloadSha256"] = payload_hash
        receipt["bundlePayloadExpectations"] = bundled_payload_expectations(payload, payload.parent, receipt["installedTauri"])
        need(receipt["bundlePayloadExpectations"]["rawInputSha256"] == payload_hash, "built_payload_changed_before_expectations")
        payload_hashes = receipt["bundlePayloadExpectations"]["formatExpectedSha256"]
        candidates = installers(ROOT / "desktop/src-tauri/target" / TARGET / "release/bundle")
        candidate_metadata = {}
        for kind, candidate in candidates.items():
            expected_hash = digest(candidate)
            if kind == 'nsis': require_pe_role(candidate, 'NsisInstaller')
            metadata = json.loads(runner.run("metadata-" + kind, [tools["pwsh.exe"], "-NoProfile", "-NonInteractive", "-File", ROOT / "scripts/windows_installer_metadata.ps1", "-Candidate", candidate, "-ExpectedVersion", version, "-ArtifactKind", "MsiInstaller" if kind == "msi" else "NsisInstaller"], ROOT, 20))
            need(metadata["sha256"] == expected_hash and metadata["signatureStatus"] == "NotSigned", "candidate_metadata_mismatch")
            candidate_metadata[kind] = metadata
        legacy = legacy_fixtures(runner, tools, base)
        from windows_upgrade_acceptance import absent_before_owned_cycle
        codes = [legacy['msi']['metadata']['ProductCode'], candidate_metadata['msi']['ProductCode']]
        absent_before_owned_cycle(upgrade_snapshot(runner, tools, base, [], codes, 'all-installs-pristine'))
        msi_shortcut_returncheck(runner,tools,base,candidates['msi'],candidate_metadata['msi'],codes,receipt)
        from windows_upgrade_acceptance import APPLICATION_DIRECTORY, absent_after_cleanup
        for kind, candidate in candidates.items():
            absent_before_owned_cycle(upgrade_snapshot(runner, tools, base, [base / APPLICATION_DIRECTORY], codes, 'clean-'+kind+'-pristine'))
            install_one(runner, tools, base, kind, candidate, candidate_metadata[kind], version, format_payload_hash(payload_hashes, kind), receipt)
            absent_after_cleanup(upgrade_snapshot(runner, tools, base, [base / APPLICATION_DIRECTORY], codes, 'clean-'+kind+'-absent'))
            remove_empty_application_directory(base)
            need(source_snapshot(runner, tools) == frozen, "source_changed_after_install_cycle")
        receipt['upgradeCycles'] = []
        for case in ('msi-major-upgrade','nsis-silent-upgrade','nsis-update','nsis-collision-legacy','nsis-collision-current'):
            run_upgrade_cycle(runner, tools, base, case, legacy, candidates, candidate_metadata, version, payload_hashes, receipt)
            need(source_snapshot(runner, tools) == frozen, 'source_changed_after_upgrade_cycle')
        receipt['upgradeAcceptance'] = 'automated-five-cycles-passed'
        receipt["sourceUnchanged"] = source_snapshot(runner, tools) == frozen
        receipt["accepted"] = receipt["sourceUnchanged"] and all(row.get("uninstallConfirmed") for row in receipt["installations"])
    except Exception as error:
        # Fixed error classes/codes only. Tool diagnostics stay in bounded local
        # files; never dump environment values or raw arbitrary exceptions.
        receipt["failureClass"] = type(error).__name__
        receipt["failureCode"] = str(error) if isinstance(error, RuntimeError) else "fixed_controller_failure"
        raise
    finally:
        if vault_started:
            # Separate cleanup reserve, even after the shared execution budget.
            runner.deadline = time.monotonic() + 65
            try:
                need(vault_args and digest(Path(vault_args[0])) == vault_executable_hash, "synthetic_vault_executable_changed")
                runner.run("vault-final-cleanup", [*vault_args, "acceptance_vault_stage", "--nocapture"], ROOT, 60, {"AXIOM_WINDOWS_ACCEPTANCE_KEY": key, "AXIOM_WINDOWS_ACCEPTANCE_STAGE": "cleanup"})
                receipt["keyringCleanupConfirmed"] = True
            except Exception:
                receipt["accepted"] = False
                receipt["keyringCleanupConfirmed"] = False
        receipt["ownedProcessCleanupConfirmed"] = all(row["ownedJobEmpty"] for row in runner.records)
        receipt["accepted"] = receipt["accepted"] and receipt["keyringCleanupConfirmed"] and receipt["ownedProcessCleanupConfirmed"]
        rendered = primary_receipt(receipt)
        receipt = json.loads(rendered)
        (output / "RESULT.json").write_text(rendered + '\n')
        print('AXIOM_WINDOWS_INSTALLED_RESULT:' + rendered, flush=True)
    need(receipt["accepted"], "installed_validation_incomplete")


def upgrade_snapshot(runner, tools, base, directories, product_codes, label):
    from windows_upgrade_acceptance import normalized_snapshot
    args = [tools['pwsh.exe'], '-NoProfile', '-NonInteractive', '-File', ROOT / 'scripts/windows_upgrade_snapshot.ps1', '-OwnedRoot', base]
    need(len(directories) <= 2 and len(product_codes) <= 2, 'upgrade_snapshot_argument_bound')
    if directories:
        args += ['-InstallDirectory', directories[0]]
        if len(directories) == 2: args += ['-SecondInstallDirectory', directories[1]]
    else:
        # Collector accepts a fixed nonexistent owned path for pristine checks.
        args += ['-InstallDirectory', base / 'preflight-unused']
    if product_codes: args += ['-OldProductCode', product_codes[0]]
    if len(product_codes) == 2: args += ['-NewProductCode', product_codes[1]]
    raw = json.loads(runner.run(label, args, ROOT, 20))
    return normalized_snapshot(raw, parse_windows_command)


def legacy_fixtures(runner, tools, base):
    from windows_upgrade_acceptance import LEGACY_ASSETS, admitted_legacy_metadata
    folder = base / 'legacy-fixtures'
    proof = json.loads(runner.run('legacy-fixed-acquisition', [tools['python.exe'], ROOT / 'scripts/windows_legacy_acquire.py', folder], ROOT, 120))
    result = {}
    for kind, expected in LEGACY_ASSETS.items():
        path = owned_file(folder / expected['name'], folder)
        need(path.stat().st_size == expected['bytes'] and digest(path) == expected['sha256'] and proof[kind] == {'bytes':expected['bytes'], 'sha256':expected['sha256']}, 'legacy_asset_bytes_mismatch')
        if kind == 'nsis': require_pe_role(path, 'NsisInstaller')
        metadata = json.loads(runner.run('legacy-metadata-'+kind, [tools['pwsh.exe'], '-NoProfile', '-NonInteractive', '-File', ROOT / 'scripts/windows_installer_metadata.ps1', '-Candidate', path, '-ExpectedVersion', '0.1.21', '-Role', 'Legacy', '-ArtifactKind', 'MsiInstaller' if kind == 'msi' else 'NsisInstaller'], ROOT, 20))
        converted = {'sha256':metadata['sha256'], 'bytes':metadata['bytes'], 'version':metadata['ProductVersion'].removesuffix('.0') if metadata['ProductVersion'] == '0.1.21.0' else metadata['ProductVersion'], 'productName':metadata['ProductName'], 'machine':metadata['machine'], 'artifactKind':metadata['artifactKind'], 'upgradeCode':metadata.get('UpgradeCode')}
        admitted_legacy_metadata(kind, converted)
        result[kind] = {'path':path, 'metadata':metadata}
    return result


def run_upgrade_cycle(runner, tools, base, case, legacy, candidates, candidate_metadata, version, payload_hashes, receipt):
    from windows_upgrade_acceptance import upgrade_commands, absent_before_owned_cycle, absent_after_cleanup, upgrade_audit, LEGACY_ASSETS
    collision = case.removeprefix('nsis-collision-') if case.startswith('nsis-collision-') else None
    recipe = 'nsis-update' if collision else case
    kind = 'msi' if recipe == 'msi-major-upgrade' else 'nsis'
    payload_hash = format_payload_hash(payload_hashes, kind)
    need(digest(legacy[kind]['path']) == LEGACY_ASSETS[kind]['sha256'] and legacy[kind]['path'].stat().st_size == LEGACY_ASSETS[kind]['bytes'], 'legacy_asset_changed_before_cycle')
    need(digest(candidates[kind]) == candidate_metadata[kind]['sha256'], 'candidate_changed_before_cycle')
    plan = upgrade_commands(recipe, tools, base, legacy[kind]['path'], candidates[kind])
    install = Path(plan['installDirectory']); executable = install / 'axiom-desktop.exe'
    need(not install.exists(), 'upgrade_install_directory_not_fresh')
    codes = [legacy['msi']['metadata']['ProductCode'], candidate_metadata['msi']['ProductCode']]
    need(len(set(codes)) == 2, 'major_upgrade_product_codes_not_distinct')
    absent_before_owned_cycle(upgrade_snapshot(runner, tools, base, [install], codes, case+'-pristine'))
    for code in codes: msi_absent(product_state(code))
    row = {'case':case, 'installKind':kind, 'oldInstallerSha256':digest(legacy[kind]['path']), 'candidateSha256':digest(candidates[kind]), 'oldInstallConfirmed':False, 'upgradeConfirmed':False, 'expectedCollisionRefused':False, 'cleanupConfirmed':False, 'webviewRenderingVerified':False}
    receipt['upgradeCycles'].append(row)
    attempted = False; fixture = None
    def collision_command(mode):
        args = [tools['pwsh.exe'], '-NoProfile', '-NonInteractive', '-File', ROOT / 'scripts/windows_shortcut_collision.ps1', '-OwnedRoot', base, '-InstallDirectory', install, '-Slot', collision, '-Mode', mode]
        if fixture: args += ['-ExpectedSha256', fixture['sha256']]
        return args
    try:
        require_webview_runtime()
        attempted = True
        log = runner.output / (case+'-old-install.log')
        old_args = plan['oldInstall'] + (['/L*v',log] if kind == 'msi' else [])
        try:
            runner.run(case+'-old-install', old_args, ROOT, 120, extra_logs=(log,) if kind == 'msi' else ())
        finally:
            if kind == 'msi':
                # Observation precedes the unchanged expected-payload assertion,
                # including a failed installer return; it grants no acceptance.
                from windows_msi_observation import observe_legacy_setup
                row['legacySetupObservation'] = observe_legacy_setup(runner,tools,base,install,legacy[kind]['path'],legacy['msi']['metadata']['ProductCode'],log)
        old_exe = owned_file(executable, install)
        require_pe_role(old_exe, 'Application')
        row['legacyInstalledPayloadSha256'] = digest(old_exe)
        old_state = upgrade_snapshot(runner, tools, base, [install], codes, case+'-old-state')
        need(len(old_state['products']) == 1 and old_state['products'][0]['displayName'] == 'Axiom Agent' and old_state['products'][0]['version'] == '0.1.21', 'legacy_install_identity_unconfirmed')
        need(old_state['shortcuts'] and all(protocol_args_match(command, executable) for command in old_state['protocolCommands']) and old_state['protocolCommands'], 'legacy_shortcut_or_protocol_unconfirmed')
        row['oldInstallConfirmed'] = True
        if collision: fixture = json.loads(runner.run(case+'-collision-create', collision_command('Create'), ROOT, 20))
        # Recheck exact fixed artifacts immediately before the upgrade attempt.
        need(digest(legacy[kind]['path']) == row['oldInstallerSha256'] and digest(candidates[kind]) == row['candidateSha256'], 'upgrade_installer_replaced')
        require_webview_runtime()
        log = runner.output / (case+'-upgrade.log')
        new_args = plan['candidateUpgrade'] + (['/L*v',log] if kind == 'msi' else [])
        runner.run(case+'-candidate', new_args, ROOT, 120, allow=(2,) if collision else (0,), extra_logs=(log,) if kind == 'msi' else ())
        if collision:
            proof = json.loads(runner.run(case+'-collision-preserved', collision_command('Verify'), ROOT, 20))
            need(proof['preserved'], 'foreign_shortcut_not_preserved')
            row['expectedCollisionRefused'] = True
        else:
            current = upgrade_snapshot(runner, tools, base, [install], codes, case+'-upgraded-state')
            row['audit'] = upgrade_audit(current, executable=executable, sha256=payload_hash, version=version)
            runner.run(case+'-launch', [executable], install, 30, observe_window=True)
            row['nativeTopLevelWindowObserved'] = True
            row['upgradeConfirmed'] = True
    finally:
        if attempted:
            prior = runner.deadline; runner.deadline = max(prior, time.monotonic()+125)
            try:
                if kind == 'msi':
                    for number,code in enumerate(codes):
                        log = runner.output / (case+f'-uninstall-{number}.log')
                        runner.run(case+f'-uninstall-{number}', [tools['msiexec.exe'],'/x',code,'/qn','/norestart','/L*v',log], ROOT, 55, allow=(0,1605), extra_logs=(log,))
                        msi_absent(product_state(code))
                else:
                    uninstaller = owned_file(install/'uninstall.exe', install); frozen = digest(uninstaller)
                    runner.run(case+'-uninstall', [uninstaller,'/S','_?='+str(install)], ROOT, 90)
                    if uninstaller.exists():
                        need(digest(uninstaller) == frozen and not uninstaller.is_symlink(), 'upgrade_uninstaller_replaced')
                        uninstaller.unlink()
                if fixture:
                    proof=json.loads(runner.run(case+'-collision-after-uninstall', collision_command('Verify'), ROOT, 10))
                    need(proof['preserved'], 'foreign_shortcut_removed_by_uninstall')
                    row['foreignPreservedThroughUninstall']=True
                    proof=json.loads(runner.run(case+'-collision-owned-cleanup', collision_command('Cleanup'), ROOT, 10))
                    need(proof['removed'], 'owned_foreign_fixture_cleanup_failed')
                absent_after_cleanup(upgrade_snapshot(runner, tools, base, [install], codes, case+'-cleaned-state'))
                from windows_residual_metadata import installation_residual_metadata
                try:
                    row['installationDirectoryResidualMetadata'] = installation_residual_metadata(base)
                except Exception:
                    row['installationDirectoryResidualMetadata'] = {'metadataUnavailable':True,'entries':[]}
                if any(item.get('relativeName','').lower().endswith('.lnk') and item.get('type')=='file' for item in row['installationDirectoryResidualMetadata']['entries']):
                    try:
                        row['residualShortcutMetadata'] = json.loads(runner.run(case+'-residual-shortcuts', [tools['pwsh.exe'], '-NoProfile', '-NonInteractive', '-File', ROOT/'scripts/windows_residual_shortcuts.ps1', '-OwnedRoot', base, '-OldProductCode', codes[0], '-NewProductCode', codes[1]], ROOT, 15))
                    except Exception:
                        row['residualShortcutMetadataUnavailable'] = True
                need(not install.exists() or not any(install.iterdir()), 'upgrade_install_directory_residuals')
                remove_empty_application_directory(base)
                row['cleanupConfirmed'] = True
            finally: runner.deadline = prior
    need(row['cleanupConfirmed'] and (row['expectedCollisionRefused'] if collision else row['upgradeConfirmed']), 'upgrade_cycle_incomplete')


def protocol_state():
    import winreg
    found = []
    for hive in [winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE]:
        for view in [winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY]:
            try:
                with winreg.OpenKey(hive, r"Software\Classes\axiom-agent\shell\open\command", 0, winreg.KEY_READ | view) as key:
                    found.append(winreg.QueryValue(key, None))
            except FileNotFoundError:
                pass
    return found


def product_state(code):
    from ctypes import wintypes as W
    msi = ctypes.WinDLL("msi", use_last_error=True)
    msi.MsiQueryProductStateW.argtypes = [W.LPCWSTR]; msi.MsiQueryProductStateW.restype = ctypes.c_int
    return msi.MsiQueryProductStateW(code)


def msi_shortcut_returncheck(runner,tools,base,candidate,metadata,codes,receipt):
    from windows_upgrade_acceptance import APPLICATION_DIRECTORY, absent_before_owned_cycle, absent_after_cleanup
    install=base/APPLICATION_DIRECTORY
    need(not install.exists() and digest(candidate)==metadata['sha256'], 'msi_refusal_candidate_or_directory_changed')
    for code in codes: msi_absent(product_state(code))
    absent_before_owned_cycle(upgrade_snapshot(runner,tools,base,[install],codes,'msi-returncheck-pristine'))
    row={'returncheckVerified':False,'foreignLinkPreserved':False,'cleanupConfirmed':False}
    receipt['msiShortcutReturncheck']=row
    fixture=None;attempted=False
    def fixture_command(mode):
        args=[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',ROOT/'scripts/windows_shortcut_collision.ps1','-OwnedRoot',base,'-InstallDirectory',install,'-Slot','current','-DesktopKind','Public','-Mode',mode]
        if fixture:args+=['-ExpectedSha256',fixture['sha256']]
        return args
    try:
        fixture=json.loads(runner.run('msi-returncheck-fixture-create',fixture_command('Create'),ROOT,15))
        need(isinstance(fixture.get('sha256'),str) and re.fullmatch(r'[a-f0-9]{64}',fixture['sha256']) is not None,'msi_foreign_fixture_proof_invalid')
        attempted=True;log=runner.output/'msi-returncheck-install.log'
        runner.run('msi-returncheck-refusal',[tools['msiexec.exe'],'/i',candidate,'/qn','/norestart','INSTALLDIR='+str(install),'/L*v',log],ROOT,90,allow=(1603,),extra_logs=(log,))
        with log.open('rb') as stream:raw=stream.read(MAX_LOG_BYTES+1)
        need(len(raw)<=MAX_LOG_BYTES,'msi_refusal_log_bound')
        text=raw.decode('utf-16-le' if b'\x00' in raw else 'utf-8',errors='replace')
        row['fixedActionObserved']='V19ShortcutPreflight' in text
        row['fixedOwnershipErrorObserved']='Foreign shortcut preserved' in text
        need(row['fixedActionObserved'] and row['fixedOwnershipErrorObserved'],'msi_expected_refusal_not_observed')
        msi_absent(product_state(metadata['ProductCode']))
        proof=json.loads(runner.run('msi-returncheck-fixture-preserved',fixture_command('Verify'),ROOT,15))
        need(proof.get('preserved') is True,'msi_foreign_shortcut_changed')
        current=upgrade_snapshot(runner,tools,base,[install],codes,'msi-returncheck-refused-state')
        need(not current['products'] and not current['protocolCommands'] and not current['ownedPayloads'],'msi_refusal_mutated_product')
        shortcuts=current['shortcuts']
        need(len(shortcuts)==1 and windows_path_identity(shortcuts[0]['path'])==windows_path_identity(fixture['path']) and windows_path_identity(shortcuts[0]['target'])==windows_path_identity(fixture['target']) and shortcuts[0].get('arguments','')=='','msi_refusal_shortcut_scope_changed')
        row['foreignLinkPreserved']=True;row['returncheckVerified']=True
    finally:
        if fixture:
            prior=runner.deadline;runner.deadline=max(prior,time.monotonic()+125)
            try:
                if attempted:
                    log=runner.output/'msi-returncheck-uninstall.log'
                    runner.run('msi-returncheck-product-cleanup',[tools['msiexec.exe'],'/x',metadata['ProductCode'],'/qn','/norestart','/L*v',log],ROOT,60,allow=(0,1605),extra_logs=(log,))
                    msi_absent(product_state(metadata['ProductCode']))
                preserved=json.loads(runner.run('msi-returncheck-fixture-cleanup-proof',fixture_command('Verify'),ROOT,15))
                need(preserved.get('preserved') is True,'msi_foreign_shortcut_cleanup_proof_changed')
                proof=json.loads(runner.run('msi-returncheck-fixture-cleanup',fixture_command('Cleanup'),ROOT,15))
                need(proof.get('removed') is True,'msi_foreign_shortcut_cleanup_failed')
                absent_after_cleanup(upgrade_snapshot(runner,tools,base,[install],codes,'msi-returncheck-cleaned'))
                remove_empty_application_directory(base);row['cleanupConfirmed']=True
            finally:runner.deadline=prior
    need(row['returncheckVerified'] and row['cleanupConfirmed'],'msi_shortcut_returncheck_incomplete')


def remove_empty_application_directory(base):
    from windows_upgrade_acceptance import APPLICATION_DIRECTORY
    base = Path(base)
    need(base.is_dir() and not base.is_symlink(), 'application_owner_root_invalid')
    install = base / APPLICATION_DIRECTORY
    need(not install.is_symlink(), 'application_directory_link_refused')
    if not install.exists(): return
    need(install.is_dir() and install.resolve(strict=True) == base.resolve(strict=True) / APPLICATION_DIRECTORY, 'application_directory_physical_scope_changed')
    need(not any(install.iterdir()), 'application_directory_residuals')
    install.rmdir()  # Never recursive; only the fixed proven-empty owned child.


def install_one(runner, tools, base, kind, candidate, metadata, version, payload_hash, receipt):
    from windows_upgrade_acceptance import APPLICATION_DIRECTORY
    install = base / APPLICATION_DIRECTORY
    need(not install.exists() and not protocol_state(), "installation_not_pristine")
    row = {"kind": kind, "installerSha256": digest(candidate), "metadata": metadata, "installConfirmed": False, "uninstallConfirmed": False, "visualAcceptance": "UNVERIFIED"}
    receipt["installations"].append(row)
    need(row["installerSha256"] == metadata["sha256"], "installer_changed_after_metadata")
    attempted = False
    uninstaller = None
    try:
        row['webviewRuntimePreflight'] = require_webview_runtime()
        if kind == "msi":
            msi_absent(product_state(metadata["ProductCode"]))
        attempted = True
        if kind == "msi":
            log = runner.output / "msi-install.log"
            runner.run("install-msi", [tools["msiexec.exe"], "/i", candidate, "/qn", "/norestart", "INSTALLDIR=" + str(install), "/L*v", log], ROOT, 120, extra_logs=(log,))
            need(product_state(metadata["ProductCode"]) == 5, "msi_product_not_installed")
        else:
            runner.run("install-nsis", [candidate, "/S", "/D=" + str(install)], ROOT, 120)
        executable = owned_file(install / "axiom-desktop.exe", install)
        require_pe_role(executable, 'Application')
        row["expectedPayloadSha256"] = payload_hash
        row["installedPayloadSha256"] = digest(executable)
        row["installedPayloadBytes"] = executable.stat().st_size
        row["installedMachine"] = "AMD64"
        metadata_ok = False
        try:
            row["installedVersionMetadata"] = json.loads(runner.run("installed-metadata-" + kind, [tools["pwsh.exe"], "-NoProfile", "-NonInteractive", "-File", ROOT / "scripts/windows_installer_metadata.ps1", "-Candidate", executable, "-ExpectedVersion", version, "-ArtifactKind", "Application"], ROOT, 20))
            metadata_ok = True
        except Exception:
            row["installedVersionMetadataUnavailable"] = True
        need(row["installedPayloadSha256"] == payload_hash, "installed_payload_mismatch")
        need(metadata_ok, "installed_metadata_unavailable")
        row["installConfirmed"] = True
        if kind == "nsis":
            found = list(install.glob("uninstall*.exe"))
            need(len(found) == 1, "owned_nsis_uninstaller_unavailable")
            uninstaller = owned_file(found[0], install)
        registration = protocol_state()
        need(registration and all(protocol_args_match(parse_windows_command(value), executable) for value in registration), "installed_protocol_identity_mismatch")
        row["protocolRegistered"] = True
        runner.run("launch-" + kind, [executable], install, 30, observe_window=True)
        row["nativeTopLevelWindowObserved"] = True
        # No click, browser sign-in, session injection, screenshot or purported
        # authenticated/painted WebView acceptance follows from a top-level HWND.
    finally:
        if attempted:
            # Reserve uninstall time after failure; do not widen execution stages.
            prior_deadline = runner.deadline
            runner.deadline = max(prior_deadline, time.monotonic() + 125)
            try:
                if kind == "msi":
                    log = runner.output / "msi-uninstall.log"
                    runner.run("uninstall-msi", [tools["msiexec.exe"], "/x", metadata["ProductCode"], "/qn", "/norestart", "/L*v", log], ROOT, 120, allow=(0, 1605), extra_logs=(log,))
                    msi_absent(product_state(metadata["ProductCode"]))
                else:
                    if uninstaller is None:
                        found = list(install.glob("uninstall*.exe"))
                        need(len(found) == 1, "nsis_cleanup_uninstaller_unavailable")
                        uninstaller = owned_file(found[0], install)
                    # NSIS _?= keeps uninstall execution in the original owned
                    # process instead of spawning an unobserved temp copy.
                    uninstaller_hash = digest(uninstaller)
                    runner.run("uninstall-nsis", [uninstaller, "/S", "_?=" + str(install)], ROOT, 120)
                    # _?= deliberately disables NSIS's temp-copy/self-delete.
                    # Remove only the exact owned unchanged uninstaller after
                    # its process Job is confirmed empty.
                    if uninstaller.exists():
                        need(not uninstaller.is_symlink() and digest(uninstaller) == uninstaller_hash, "uninstaller_replaced")
                        uninstaller.unlink()
                        row["ownedUninstallerRemovedAfterExit"] = True
                need(not (install / "axiom-desktop.exe").exists() and not protocol_state(), "installed_files_or_protocol_remain")
                need(not install.exists() or not any(install.iterdir()), "install_directory_residuals_remain")
                row["uninstallConfirmed"] = True
            finally:
                runner.deadline = prior_deadline


if __name__ == "__main__":
    main()
